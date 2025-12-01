from langchain_community.vectorstores import FAISS
#from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import WebBaseLoader
from langchain_core.documents import Document

import os

class VectorStoreManager:
    # def __init__(self, embedding_model):
    #     self.embedding = HuggingFaceEmbeddings(model_name=embedding_model)
    #     self.vector_store = None
    def __init__(self, embedding_model):
        # Isolate embedding model cache
        os.environ["HF_HOME"] = os.path.join(os.getcwd(), "embedding_cache")
        os.makedirs(os.environ["HF_HOME"], exist_ok=True)
        
        self.embedding = HuggingFaceEmbeddings(
            model_name=embedding_model,
            cache_folder=os.environ["HF_HOME"]
        )
        self.vector_store = None
        
    def create_vector_store(self, docs):
        self.vector_store = FAISS.from_documents(docs, embedding=self.embedding)
        return self.vector_store
        
    def update_vector_store(self, link):
        docs = self._get_docs_from_web(link)
        if self.vector_store:
            self.vector_store.add_documents(docs)
        else:
            self.create_vector_store(docs)
        return self.vector_store
        
    def _get_docs_from_web(self, link):
        loader = WebBaseLoader(link)
        docs = loader.load()
        
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=400,
            chunk_overlap=20
        )
        return text_splitter.split_documents(docs)