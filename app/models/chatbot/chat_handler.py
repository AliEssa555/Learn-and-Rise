# app/models/chatbot/chat_handler.py

import os
from typing import List

from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.documents import Document

# NOTE: this file does NOT import langchain.chains or langchain_community.chains

class ChatHandler:
    def __init__(self, llm, vector_store, max_docs: int = 6):
        """
        llm: a runnable-like or callable LLM object. Examples:
             - langchain.llms.OpenAI() (Runnable) -> has .invoke()
             - any simple callable that takes a string and returns a string
        vector_store: an object with .as_retriever() returning a Retriever with get_relevant_documents(query)
        max_docs: how many retrieved docs to include in the context
        """
        self.llm = llm
        self.vector_store = vector_store
        self.retriever = self.vector_store.as_retriever()
        self.max_docs = max_docs
        self.chat_history: List = []  # list of HumanMessage / AIMessage
        # a system message you can customize as needed
        self.system_message = SystemMessage(content="You are a helpful assistant. Use the provided context to answer user questions.")

        # Build a prompt template that expects {context} and {input}.
        # MessagesPlaceholder will be filled with the conversation history when formatting.
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", "{system_message}"),
            MessagesPlaceholder(variable_name="chat_history"),
            ("user", "Context:\n{context}\n\nQuestion: {input}")
        ])

    def _format_context(self, docs: List[Document]) -> str:
        # Create a compact combined context. You can instead render titles/metadata if you want.
        pieces = []
        for i, d in enumerate(docs[: self.max_docs]):
            # include small separator and optional metadata
            meta = getattr(d, "metadata", {}) or {}
            source = meta.get("source") or meta.get("id") or f"doc-{i+1}"
            pieces.append(f"--- Document {i+1} (source: {source}) ---\n{d.page_content.strip()}")
        return "\n\n".join(pieces) if pieces else "No context found."

    def _call_llm(self, messages):
        """
        Call the LLM in a robust way:
        - If llm has .invoke, call llm.invoke({"messages": messages})
        - else if it's callable, call llm(messages)
        - else if it has .generate, call .generate(...) and extract text
        Returns a plain answer string.
        """
        # Case 1: Runnable-like LLM (LCEL)
        if hasattr(self.llm, "invoke"):
            # many Runnable LLMs accept a dict payload — we pass messages
            out = self.llm.invoke({"messages": messages})
            # The exact return shape can differ: attempt to unwrap plausibly
            if isinstance(out, dict):
                # common keys: "output", "text", "answer", "result"
                for k in ("output", "text", "answer", "result"):
                    if k in out and isinstance(out[k], str):
                        return out[k]
                # if it's nested, try to stringify
                return str(out)
            # otherwise return string-converted result
            return str(out)

        # Case 2: Sync callable that accepts a list/str
        if callable(self.llm):
            try:
                # try just passing the formatted messages as a plain string
                # convert messages to single text
                text = "\n".join(f"{m.type}: {m.content}" for m in messages)
                res = self.llm(text)
                return str(res)
            except TypeError:
                # fallback: pass the messages object
                res = self.llm(messages)
                return str(res)

        # Case 3: object with .generate (LangChain LLMs sometimes)
        if hasattr(self.llm, "generate"):
            # many .generate methods accept lists of messages or prompts
            try:
                gen = self.llm.generate(messages)
                # attempt to extract string(s)
                if hasattr(gen, "generations"):
                    # shape varies; pick first
                    first = gen.generations[0][0]
                    if hasattr(first, "text"):
                        return first.text
                return str(gen)
            except Exception:
                return "Error: LLM generate call failed."

        raise RuntimeError("Unsupported LLM object: please pass a Runnable-like or callable LLM.")

    def process_chat(self, user_input: str) -> str:
        # 1. Retrieve documents relevant to the user's current input AND optionally the chat history
        # For conversation-aware retrieval you can alter query to include last user message(s).
        docs = self.retriever.get_relevant_documents(user_input)

        # 2. Build the combined context text
        context_text = self._format_context(docs)

        # 3. Format messages using the ChatPromptTemplate and include chat history
        # The ChatPromptTemplate expects the "chat_history" placeholder to be a list of messages
        # Use a string for system_message (we inserted a placeholder "{system_message}")
        raw_messages = self.prompt.format_messages({
            "system_message": self.system_message.content,
            "chat_history": self.chat_history,
            "context": context_text,
            "input": user_input
        })

        # raw_messages is a list of Message objects (SystemMessage/HumanMessage/AIMessage).
        # 4. Call the LLM with these messages
        answer = self._call_llm(raw_messages)

        # 5. Update chat history
        self.chat_history.append(HumanMessage(content=user_input))
        self.chat_history.append(AIMessage(content=answer))

        return answer
