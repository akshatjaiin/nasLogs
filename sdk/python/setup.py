from setuptools import setup, find_packages

setup(
    name="nas-logs",
    version="0.1.0",
    description="Python SDK for NAS Logs — Sentry for Cloud Network Costs & Egress Attribution",
    author="NAS Logs Authors",
    author_email="dev@naslogs.io",
    packages=find_packages(),
    python_requires=">=3.8",
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
)
