import sys
print("Starting debug run...", file=sys.stderr)
try:
    print("Importing app...", file=sys.stderr)
    from run import app
    print("App imported successfully. Starting server...", file=sys.stderr)
    app.run(debug=False, host='0.0.0.0', port=5000)
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"Failed: {e}", file=sys.stderr)
