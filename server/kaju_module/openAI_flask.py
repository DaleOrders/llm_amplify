def getTheStuffFromTheAI(transcription):
    annotations = [
        {
            "phrase": "a very",
            "data_elem_num": "eDisposition.16",
            "data_elem_val": "4216009",
        },
        {
            "phrase": "short test.",
            "data_elem_num": "eDisposition.26",
            "data_elem_val": "4226005",
        },
        {
            "phrase": "test.",
            "data_elem_num": "eHistory.02",  # patient last name
            "data_elem_val": "Meow",  # data elem num with no enumeration (arbitrary input)
        },
    ]
    narrative = "A summary of the things stated in the transcript..."
    return annotations, narrative


'''import json

from openai import OpenAI

from typing import Optional, List, Dict

from pydantic import ValidationError, BaseModel, Field

from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.output_parsers import PydanticOutputParser

from credentials import api_key

#from .models import api_key  # Ensure api_key is imported from credentials or settings

# Define the LLM model
llm = ChatOpenAI(model="gpt-4o-mini", api_key=api_key)

# Pydantic models
class CodeEntry(BaseModel):
    Code: str = Field(..., description="The code number")
    CodeDescription: str = Field(..., description="The description of the code")
    SyntheticPhrases: str = Field(..., description="The short phrase of the code")

class ElementNumber(BaseModel):
    Definition: str = Field(..., description="The definition of the eVitals element")
    Code: List[CodeEntry]

class RootModel(BaseModel):
    eVitals: Dict[str, ElementNumber]

# Function to load JSON
def load_json(file_path: str):
    try:
        with open(file_path, 'r') as file:
            data = json.load(file)
            return data
    except FileNotFoundError:
        raise FileNotFoundError(f"Error: File {file_path} not found.")
    except json.JSONDecodeError:
        raise ValueError(f"Error: Could not decode JSON from file {file_path}.")

# Function to create a prompt for the LLM
def create_prompt(data: dict) -> str:
    prompt_template = """
    You are an assistant that generates short synthetic phrases (1-5 words) for medical codes based on their descriptions.

    Given the following data:
    {data}

    Please add a "SyntheticPhrases" field to each code entry with an list of relevant phrases. Ensure the output strictly follows the provided schema. Do not add any Backticks (```) or any other formatting.

    Example Output:
    {{
      "eVitals.03": {{
        "Definition": "The cardiac rhythm / ECG and other electrocardiography findings of the patient as interpreted by EMS personnel.",
        "Code": [
          {{
            "Code": "9901001",
            "CodeDescription": "Agonal/Idioventricular",
            "SyntheticPhrases": [
              "Irregular Heartbeat",
              "Asystole"
            ]
          }},
          // ... other codes
        ]
      }}
    }}
    Now, process the given data accordingly.
    """
    prompt = prompt_template.format(data=json.dumps(data, indent=2))
    return prompt

# Main function to integrate with Django
def generate_synthetic_phrases():
    # Define the internal file path
    file_path = "/path/to/your/json/file.json"  # Adjust the path as needed
    # Load the data from the JSON file
    data = load_json(file_path)

    if data:
        # Generate the prompt for the LLM
        prompt = create_prompt(data)
        
        try:
            # Generate the response from the OpenAI model
            response = llm.predict(prompt)

            # Parse the response using Pydantic models
            parsed_response = RootModel.model_validate_json(response)
            return parsed_response
        except ValidationError as ve:
            return f"Validation Error: {ve}"
        except Exception as e:
            return f"Error: {e}"

    return "Error: Failed to load JSON data." '''