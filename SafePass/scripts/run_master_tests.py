import importlib
import sys
import os


def run():
    # ensure project root is on sys.path so 'tests' package can be imported
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if root not in sys.path:
        sys.path.insert(0, root)
    m = importlib.import_module('tests.test_master_password_flow')
    try:
        if hasattr(m, 'setup_module'):
            m.setup_module(m)
        # run the single test
        if hasattr(m, 'test_master_change_flow'):
            m.test_master_change_flow()
            print('TEST PASSED: test_master_change_flow')
        else:
            print('No test_master_change_flow found')
    except AssertionError as e:
        print('TEST FAILED:', e)
        sys.exit(2)
    except Exception as e:
        print('ERROR RUNNING TEST:', e)
        raise
    finally:
        try:
            if hasattr(m, 'teardown_module'):
                m.teardown_module(m)
        except Exception as e:
            print('ERROR in teardown:', e)

if __name__ == '__main__':
    run()
