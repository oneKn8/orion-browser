"""
Allow running build package as module: python -m build
"""
from .orion import app

if __name__ == "__main__":
    app()
