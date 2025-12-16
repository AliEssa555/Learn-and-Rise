
import importlib
import pkgutil
import sys

def find_symbol(package_name, symbol):
    try:
        module = importlib.import_module(package_name)
        if hasattr(module, symbol):
            print(f"Found {symbol} in {package_name}")
            return True
    except ImportError:
        pass
    except Exception as e:
        # print(f"Error importing {package_name}: {e}")
        pass
    return False

print("Searching for symbols...")
symbols = ["create_retrieval_chain", "create_stuff_documents_chain"]
locations = [
    "langchain.chains",
    "langchain.chains.retrieval",
    "langchain.chains.combine_documents",
    "langchain.retrieval",
    "langchain_core.runnables",
    "langchain.runnables",
    "langchain_community.chains",
    "langchain.chains.question_answering",
    "langchain.chains.retrieval_qa.base",
]

for loc in locations:
    for sym in symbols:
        find_symbol(loc, sym)

print("Done searching.")
