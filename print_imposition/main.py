"""
Poligrafiya Vektorli Montaj (Imposition) va Preflight - Asosiy Kirish Nuqtasi
"""

import sys

def main():
    if len(sys.argv) > 1 and ("--front" in sys.argv or "-f" in sys.argv or "--help" in sys.argv or "-h" in sys.argv):
        from imposition.cli import main as cli_main
        cli_main()
    else:
        from imposition.gui import launch_gui
        launch_gui()

if __name__ == "__main__":
    main()
