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