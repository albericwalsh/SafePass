import time

file ='log.txt'

def initialize():
    global file
    file = 'log' + str(time.strftime('%d-%m-%Y-%H-%M')) + '.txt'
    with open(file, 'w') as f:
        f.write('log file created at ' + time.strftime('%c') + '\n')

def log(message):
    global file
    with open(file, 'a') as f:
        f.write(time.strftime('%c') + ' - ' + str(message) + '\n')
    print(time.strftime('%c') + ' - ' + str(message) + '\n')