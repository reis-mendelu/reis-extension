prod:bool = True
def debug_print(*values: object):
    if prod:
        return
    print(values)