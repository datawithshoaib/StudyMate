import shutil
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"


def main() -> None:
    for command in ("uv", "npm"):
        if shutil.which(command) is None:
            raise SystemExit(f"{command} is required but was not found on PATH.")

    processes = [
        subprocess.Popen(
            ["uv", "run", "uvicorn", "app.main:app", "--reload", "--port", "8000"],
            cwd=BACKEND,
        ),
        subprocess.Popen(
            ["npm", "run", "dev", "--", "--port", "3000"],
            cwd=FRONTEND,
        ),
    ]

    print("StudyMate is starting:")
    print("  Backend:  http://localhost:8000")
    print("  Frontend: http://localhost:3000")
    print("Press Ctrl+C to stop both servers.")

    try:
        while any(process.poll() is None for process in processes):
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        for process in processes:
            if process.poll() is None:
                process.terminate()
        for process in processes:
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()


if __name__ == "__main__":
    main()
