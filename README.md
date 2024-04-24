# perfGenie

<a href="https://opensource.org/licenses/BSD-3-Clause" rel="nofollow"><img src="https://camo.githubusercontent.com/8ccf186e7288af6d88a1f6a930c0fcc4e7a8a9936b34e07629d815d1eab4d977/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f4c6963656e73652d425344253230332d2d436c617573652d626c75652e737667" alt="License" data-canonical-src="https://img.shields.io/badge/License-BSD%203--Clause-blue.svg" style="max-width: 100%;"></a>

perfGenie is a continuous low overhead contextual profiling solution that can parse and visualize Java flight recorder(JFR) format profile and Jstacks. JFR profiles can be created using Java machine control(JMC), Java flight recorder, Async-profiler, or jcmd. It provides the ability to view profiles in context trees, samples explorer, flame Graph, thread state, river, and hotspot surface views. It helps to compare two profiles using context tree diff or flame graph diff views. It also provides functionality to filter profiles for a given custom event context, tid or thread name, etc. The request timeline view helps look at samples of a particular request context. It also can visualize thread context requests and context metric timeline views. The aggregation feature allows for combining profiles for a more extended period. Thread dumps can also be converted into supported profile views.


### Continuous low overhead contextual profiling ✨

perfGenie can be deployed as a continuous profiling solution. It uses Cantor (https://github.com/salesforce/cantor) as a data layer. Cantor can be configured to store data in H2, MySQL, or S3. This project is set up with a simple cron job to monitor a directory for any JFR files, parse and store in H2 (default configuration).

<img src="https://github.com/salesforce-misc/perfGenie/blob/main/perfgenie/src/main/resources/static/images/flow.jpg?raw=true" width="500"  />

### Development

#### Create a new Fork and Clone the repository

```sh
$ git clone git@github.com:salesforce-misc/perfGenie.git
```

#### Build

```sh
$ export JAVA_HOME=<jdk home path>
$ mvn clean install
```

#### Config

add profiles and custom events to be parsed in config.properties file

```sh
ex:
customevents=LogContext;MqFrm;CPUEvent;MemoryEvent;Search
profiles=ExecutionS;Socket;NewTLAB;OutsideTLAB
jfrdir=/tmp/jfrs
tenant=dev

#h2,grpc,mySQL
storageType=h2

#h2 config
h2dir=/tmp/h2.db

#mySQL config
mySQL.host=xxxx
mySQL.port=3306
mySQL.user=xxxx
mySQL.pwd=xxxx

#grpc, cantor server
grpc.target=localhost:7443

#filtering
threshold=0.05
filterDepth=4
maxStackDepth=10

#experimental to enable river view and surface views
isExperimental=false


```

#### Start application server
```sh
$ java -jar perfgenie/target/perfgenie.jar
```
Access URL http://localhost:8080

#### How to add JFR's for testing
The application server has a cron job to monitor and parse JFR (*.jfr or .jfr.gz), and Jstack (.jstack) files available at /tmp/jfrs/ 

Note: example files provided in the examples directory can be copied into jfrdir for testing

Note: refer simulator module to generate a sample jfr with custom events added

### Agent mode
```sh
$ java -jar agent/target/agent.jar
```
Agent to monitor and parse JFR (*.jfr or .jfr.gz), and Jstack (.jstack) files available at /tmp/agent/jfrs/

### Features

- Tree view (backtrace, call tree, and compare view)
- Samples explorer view (grouping samples by tid, thread name, and custom event context dimensions)
- Flame graph view (backtrace, call tree, and compare view)
- Thread state view (This view is supported for thread dumps)
- River view (Stack trace timeline view)
- Hotspot surface (3D Stacktrace timeline view)
- Custom event table view
- Custom event context filters on the profile
- Thread request view (based on custom events)
- Metric timeline view (based on custom event metrics)
- Request timeline view (to see samples of particular request)

## User interface:
<img src="https://github.com/salesforce-misc/perfGenie/blob/main/perfgenie/src/main/resources/static/images/ui.jpg?raw=true"   />

### Context Filters

#### Context table view
<img src="https://github.com/salesforce-misc/perfGenie/blob/main/perfgenie/src/main/resources/static/images/contexttable.jpg?raw=true"/>

#### Request samples view
<img src="https://github.com/salesforce-misc/perfGenie/blob/main/perfgenie/src/main/resources/static/images/showallrequests.jpg?raw=true"/>

<img src="https://github.com/salesforce-misc/perfGenie/blob/main/perfgenie/src/main/resources/static/images/requesttimeline.jpg?raw=true"/>

#### Thread request view
<img src="https://github.com/salesforce-misc/perfGenie/blob/main/perfgenie/src/main/resources/static/images/threadrequestview.jpg?raw=true"/>

#### Metric timeline view
<img src="https://github.com/salesforce-misc/perfGenie/blob/main/perfgenie/src/main/resources/static/images/metrictimelineview.jpg?raw=true"/>

### Profile views

#### Calling context tree
<img src="https://github.com/salesforce-misc/perfGenie/blob/main/perfgenie/src/main/resources/static/images/treeview.jpg?raw=true"/>

#### Calling context tree compare view
<img src="https://github.com/salesforce-misc/perfGenie/blob/main/perfgenie/src/main/resources/static/images/treeviewdiff.jpg?raw=true"/>

#### Samples explorer
<img src="https://github.com/salesforce-misc/perfGenie/blob/main/perfgenie/src/main/resources/static/images/samplesexplorer.jpg?raw=true"/>

#### Flame graph (Brendan Gregg, https://www.brendangregg.com/flamegraphs.html)
<img src="https://github.com/salesforce-misc/perfGenie/blob/main/perfgenie/src/main/resources/static/images/flamegraph.jpg?raw=true"/>

#### Flame graph compare view
<img src="https://github.com/salesforce-misc/perfGenie/blob/main/perfgenie/src/main/resources/static/images/flamegraphdiff.jpg?raw=true"/>

#### Thread state view
<img src="https://github.com/salesforce-misc/perfGenie/blob/main/perfgenie/src/main/resources/static/images/threadstateview.jpg?raw=true"/>
<img src="https://github.com/salesforce-misc/perfGenie/blob/main/perfgenie/src/main/resources/static/images/threadstatepop.jpg?raw=true"/>

#### River view (Experimental stack trace timeline view)
<img src="https://github.com/salesforce-misc/perfGenie/blob/main/perfgenie/src/main/resources/static/images/riverview.jpg?raw=true"/>

#### Hotspot surface view (Experimental stack trace timeline view)
<img src="https://github.com/salesforce-misc/perfGenie/blob/main/perfgenie/src/main/resources/static/images/surfaceview.jpg?raw=true"/>




