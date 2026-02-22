from setuptools import setup
import os

# Read canonical version from VERSION file if present, else fall back to hardcoded
def read_version():
      vfile = os.path.join(os.path.dirname(__file__), 'VERSION')
      if os.path.exists(vfile):
            with open(vfile, 'r', encoding='utf-8') as fh:
                  return fh.read().strip()
      # fallback legacy version
      return '1.2.0.0'

setup(name='SafePass',
      version=read_version(),
      description='Password manager',
      author='Alberic WALSH DE SERRANT',
      url='https://www.python.org/sigs/distutils-sig/',
      packages=['res', 'back', 'back.routes', 'data', 'public', 'back.crypting', 'node_modules'],
      script_name='SafePass.py',
      )