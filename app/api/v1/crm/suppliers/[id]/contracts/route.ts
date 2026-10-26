import { NextRequest, NextResponse } from "next/server";
import {
  getSupplierContracts,
  upsertSupplierContract,
  deleteSupplierContract,
} from "@/lib/server/supplierService";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";

    const contracts = await getSupplierContracts(id, companyCode);
    return NextResponse.json({
      success: true,
      data: contracts,
      total: contracts.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Shartnomalarni yuklashda xatolik",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";

    const result = await upsertSupplierContract({ ...body, supplierId: id }, companyCode);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Shartnomani saqlashda xatolik",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get("contractId");
    const companyCode = searchParams.get("company") || "PRINTGOO";

    if (!contractId) {
      return NextResponse.json(
        { success: false, error: "contractId parametri majburiy" },
        { status: 400 }
      );
    }

    const result = await deleteSupplierContract(contractId, companyCode);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Shartnomani o'chirishda xatolik",
      },
      { status: 500 }
    );
  }
}
