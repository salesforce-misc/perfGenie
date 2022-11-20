# StackDigViz

StackDigViz is a Java Fligh Recorder (JFR) profile parsing and web visualizaiton tool, it provides ability to view profiles in the form of Context Trees, Samples explorer, Flame Graph, Thread State, River and Hotspot surface views. It also helps to compare two profiles using context tree diff and flame graph diff views. It also provides functionality to filter profiles for a given custom event context, tid or thread name. Request timeline view helps in looking at samples of an individual request context. It also has option to visualize thread context request and context metric timeline views. The aggregation feature helps in combining profils for a longer period. Thread dumps can also be converted into profile views.


### Continuous profiling ✨

StackDigViz can be deployed as a continuos profiling solution. It uses Cantor (https://github.com/salesforce/cantor) as a data layer, Cantor can be configred to store data in H2, MySQL or S3. This project is setup with a simple cron job to monitor a directory for any JFR files, parse and store in H2 (default configuration). 

<img src="https://github.com/salesforce-misc/StackDigViz/blob/main/src/main/resources/static/images/flow.jpg?raw=true" width="500"  />

### Development

Clone the repository:

```sh
$ git clone git@github.com:salesforce-misc/StackDigViz.git
```

Build:

```sh
$ export JAVA_HOME=<jdk8 home path>
$ mvn clean install
```

Start applicaiton server:
```sh
$ java -jar target/StackDigViz-0.0.1-SNAPSHOT.jar
```
Access URL http://localhost:8080

How to add JFR's for testing: The applicaiton server has a cron job to monitor and parser JFR files in /tmp/jfrs/ 


### Features

- Tree view (backtrace, calltree and compare view)
- Samples explorer view (grouping samples by tid, thread name and custom event cotext dimentions)
- Flame graph view (backtrace, calltree and compare view)
- Thread state view (This view is supported for thread dumps)
- River view (Stack trace timeline view)
- Hotspot surface (3D Stacktrace timeline view)
- Custom event table view
- Custom event context filters on profile
- Thread request view (based on custom events)
- Metric timeline view (based on custom event metrics)
- Request timeline view (to see samples of single request)

User interface:
<img src="https://github.com/salesforce-misc/StackDigViz/blob/main/src/main/resources/static/images/ui.jpg?raw=true"   />

