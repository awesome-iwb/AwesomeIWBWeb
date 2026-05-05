from pathlib import Path
import runpy


if __name__ == "__main__":
    target = Path(__file__).resolve().parent / "migration" / "readme_to_data.py"
    runpy.run_path(str(target), run_name="__main__")
