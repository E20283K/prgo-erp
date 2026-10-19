import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

interface IndexedComponentInfo {
  componentName: string;
  fileName: string;
  relativePath: string;
  linesOfCode: number;
}

let cachedComponentMap: Record<string, IndexedComponentInfo> | null = null;
let lastIndexTime = 0;

const SCAN_DIRS = ["components", "app"];

async function walkDir(dirPath: string, rootDir: string, acc: string[] = []): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await walkDir(fullPath, rootDir, acc);
      } else if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))) {
        acc.push(fullPath);
      }
    }
  } catch {
    // ignore missing dir
  }
  return acc;
}

async function getComponentIndex(): Promise<Record<string, IndexedComponentInfo>> {
  const now = Date.now();
  if (cachedComponentMap && now - lastIndexTime < 30_000) {
    return cachedComponentMap;
  }

  const rootDir = process.cwd();
  const files: string[] = [];
  for (const dir of SCAN_DIRS) {
    await walkDir(path.join(rootDir, dir), rootDir, files);
  }

  const map: Record<string, IndexedComponentInfo> = {};

  for (const fullPath of files) {
    try {
      const content = await fs.readFile(fullPath, "utf-8");
      const linesCount = content.split(/\r?\n/).length;
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
      const fileName = path.basename(fullPath);
      const baseNameNoExt = fileName.replace(/\.(tsx|ts)$/, "");

      // Register by file basename if PascalCase
      if (/^[A-Z]/.test(baseNameNoExt)) {
        map[baseNameNoExt] = {
          componentName: baseNameNoExt,
          fileName,
          relativePath: relPath,
          linesOfCode: linesCount,
        };
      }

      // Match exported or top-level PascalCase components:
      // export function MyComp, function MyComp, const MyComp =
      const regex = /(?:export\s+(?:default\s+)?)?(?:function|const)\s+([A-Z][A-Za-z0-9_]*)/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        const compName = match[1];
        // Prefer non-ui or primary file match if not already registered from matching filename
        if (!map[compName] || baseNameNoExt === compName) {
          map[compName] = {
            componentName: compName,
            fileName,
            relativePath: relPath,
            linesOfCode: linesCount,
          };
        }
      }
    } catch {
      // skip unreadable file
    }
  }

  cachedComponentMap = map;
  lastIndexTime = now;
  return map;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedFile = searchParams.get("file");
    const requestedComponent = searchParams.get("component");
    const indexOnly = searchParams.get("index") === "1";

    const componentMap = await getComponentIndex();

    if (indexOnly) {
      return NextResponse.json({ componentMap });
    }

    let targetRelPath = requestedFile || "";
    if (!targetRelPath && requestedComponent && componentMap[requestedComponent]) {
      targetRelPath = componentMap[requestedComponent].relativePath;
    }

    if (!targetRelPath) {
      return NextResponse.json({ componentMap, lines: [], totalLines: 0 });
    }

    // Security check: normalize and ensure inside project root
    const rootDir = process.cwd();
    const safeRelPath = targetRelPath.replace(/\\/g, "/").replace(/^\/+/, "");
    const resolvedFull = path.resolve(rootDir, safeRelPath);
    if (!resolvedFull.startsWith(rootDir)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    const content = await fs.readFile(resolvedFull, "utf-8");
    const lines = content.split(/\r?\n/);

    return NextResponse.json({
      relativePath: safeRelPath,
      fileName: path.basename(resolvedFull),
      totalLines: lines.length,
      lines,
      componentMap,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to read source file", lines: [], totalLines: 0 },
      { status: 200 }
    );
  }
}
