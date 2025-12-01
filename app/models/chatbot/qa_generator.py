from langchain_classic.chains.question_answering import load_qa_chain
from langchain_core.documents import Document
import pandas as pd
import re

class QAGenerator:
    def __init__(self, llm):
        self.qa_chain = load_qa_chain(llm, chain_type="stuff")
        
    def generate_qa_pairs(self, text_chunks):
        df = pd.DataFrame({"text": text_chunks})
        df["qa_pairs"] = df["text"].apply(lambda x: self._generate_single_qa_pair(x))
        return self._process_qa_pairs(df["qa_pairs"])
    
    def _generate_single_qa_pair(self, text):
        try:
            doc = Document(page_content=text)
            output = self.qa_chain.run(
                input_documents=[doc], 
                question="Generate 1 question-answer pair based on the context. The question and answer should be thought-provoking in terms of the context but the answer shouldnt be very long. Your output should be like this 'Question:xxxx,Answer:xxxx'."
            )
            return output
        except Exception as e:
            print(f"Error generating QA pair: {e}")
            return None
            
    def _process_qa_pairs(self, qa_pairs):
        inputs = []
        outputs = []
        
        for qa in qa_pairs:
            try:
                match = re.search(r"Question:\s*(.*?)\s*Answer:\s*(.*)", qa, re.DOTALL)
                if match:
                    question = match.group(1).strip()
                    answer = match.group(2).strip()
                    inputs.append({"question": question})
                    outputs.append({"answer": answer})
            except Exception as e:
                print(f"Error processing QA pair: {e}")
                
        return inputs, outputs