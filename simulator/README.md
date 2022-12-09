# Java Transaction Simulator

<a href="https://opensource.org/licenses/BSD-3-Clause" rel="nofollow"><img src="https://camo.githubusercontent.com/8ccf186e7288af6d88a1f6a930c0fcc4e7a8a9936b34e07629d815d1eab4d977/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f4c6963656e73652d425344253230332d2d436c617573652d626c75652e737667" alt="License" data-canonical-src="https://img.shields.io/badge/License-BSD%203--Clause-blue.svg" style="max-width: 100%;"></a>

Java Transaction Simulator is a load generation tool that provides a way to simulate Transactions using threads. This simulator can generate High CPU, High Memory, and High DiskIO transactions with a user-chosen probability. This simulator is designed to generate datasets to compare the merits of various visualization tools available for exploring Java Flight Recorder (JFR) profiles to diagnose performance issues.

### Usage

#### Clone the repository

```sh
$ git clone https://github.com/salesforce-misc/StackDigViz.git
```

#### Build

```sh
$ export JAVA_HOME=<jdk8 home path>
$ mvn clean install
```

#### Run

```sh
$ java -jar simulator/target/Simulator-0.0.1-SNAPSHOT.jar
```

#### Options
Below configuration options are available for the simulator.

```sh
$ java -jar <path to simulator jar> [options]

-t,--threads <arg>          Number of simulator thread to spin up (Default: 10)

-b,--txCount <arg>          Number of transactions per thread (Default: 1000)

-d,--maxDepth <arg>         Max depth of the transaction trace (Default: 10)

-c,--highCpuProb <arg>      Probability of high CPU events (Default: 0.05)

-i,--highIoProb <arg>       Probability of high IO events (Default: 0.01)

-m,--highMemoryProb <arg>   Probability of high Memory events (Default:0.01)

Note: Probability values range form (0-1)
```
