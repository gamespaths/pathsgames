from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.adapters.persistence.auth.models import Base
from app.config import settings
import os

def get_engine():
    if settings.env == "development":
        db_url = f"sqlite:///./{settings.db_path}"
        engine = create_engine(db_url, connect_args={"check_same_thread": False})
    else:
        db_url = f"postgresql://{settings.db_user}:{settings.db_password}@{settings.db_host}:{settings.db_port}/{settings.db_name}"
        engine = create_engine(db_url)
    return engine

engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)
