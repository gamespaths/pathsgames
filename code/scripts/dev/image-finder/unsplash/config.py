# Unsplash API Configuration
# Access Key on https://unsplash.com/developers → "New Application"
# Paste your "Access Key" below:

UNSPLASH_ACCESS_KEY = "" #

# load from environment variable if not set here
import os
from dotenv import load_dotenv
if not UNSPLASH_ACCESS_KEY:
    UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY", "")  
    #read from .env file if still not set
    if not UNSPLASH_ACCESS_KEY:
        load_dotenv()
        UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY", "")
    if not UNSPLASH_ACCESS_KEY:
        raise ValueError("Unsplash Access Key not set. Please set it in config.py or as an environment variable 'UNSPLASH_ACCESS_KEY'.")
    
