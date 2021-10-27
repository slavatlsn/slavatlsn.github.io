from flask import Flask, render_template
import datetime
app = Flask(__name__)

@app.route("/")
def hello():
  now = datetime.datetime.now()
  time = strftime("%Y-%m-%d %H:%M")
  templateData = {'title' = : 'Time:', 'time' : time}
  return render_template('index.html', **templateData)

if(__name__ == '__main__'):
  app.run()
