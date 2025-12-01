from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains import create_retrieval_chain

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.prompts.chat import MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage


class ChatHandler:
    def __init__(self, llm, vector_store):
        self.llm = llm
        self.vector_store = vector_store
        self.chain = self._create_chain()
        self.chat_history = []
        
    def _create_chain(self):
        prompt = ChatPromptTemplate.from_messages([
            ("system", "Answer the user's questions based on the context: {context}"),
            MessagesPlaceholder(variable_name="chat_history"),
            ("user", "{input}")
        ])
        
        document_chain = create_stuff_documents_chain(
            llm=self.llm,
            prompt=prompt
        )
        
        retriever = self.vector_store.as_retriever()
        return create_retrieval_chain(retriever, document_chain)
        
    def process_chat(self, user_input):
        response = self.chain.invoke({
            "chat_history": self.chat_history,
            "input": user_input,
        })
        
        self.chat_history.append(HumanMessage(content=user_input))
        self.chat_history.append(AIMessage(content=response["answer"]))
        
        return response["answer"]