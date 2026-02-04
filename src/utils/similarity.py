import functools
from typing import List, Union
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# Global cache for the model
_MODEL = None

def _get_model():
    """
    Singleton accessor for the SentenceTransformer model.
    Loads 'all-MiniLM-L6-v2' on first use.
    """
    global _MODEL
    if _MODEL is None:
        # Load the model
        _MODEL = SentenceTransformer('all-MiniLM-L6-v2')
    return _MODEL

def check_similarity(text_a: str, text_b: str) -> float:
    """
    Computes the Cosine Similarity between two text strings.
    Returns a float between -1.0 and 1.0 (typically 0.0 to 1.0 for embeddings).
    """
    model = _get_model()
    
    # Encode both texts
    embeddings = model.encode([text_a, text_b])
    
    # Compute cosine similarity
    # cosine_similarity returns a matrix [[1, sim], [sim, 1]]
    score = cosine_similarity([embeddings[0]], [embeddings[1]])[0][0]
    
    return float(score)

def calculate_cosine_distance(text_a: str, text_b: str) -> float:
    """
    Computes Cosine Distance (1 - Cosine Similarity).
    Used for Drift Checks.
    """
    sim_score = check_similarity(text_a, text_b)
    # distance = 1 - similarity
    return 1.0 - sim_score
