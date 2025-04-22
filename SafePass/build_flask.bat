pip install wheel
python setup.py bdist_wheel
pip install ./dist/SafePass-1.2-py3-none-any.whl --force-reinstall
set FLASK_APP=SafePass