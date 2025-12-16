
import pkgutil
import langchain
import sys

print(f"LangChain path: {langchain.__path__}")

try:
    for loader, module_name, is_pkg in pkgutil.walk_packages(langchain.__path__, langchain.__name__ + "."):
        if "chains" in module_name or "retrieval" in module_name:
            print(module_name)
except Exception as e:
    print(f"Error walking packages: {e}")
