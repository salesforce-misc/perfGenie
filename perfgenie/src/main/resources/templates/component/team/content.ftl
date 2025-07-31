<h4>Welcome to new component page developement</h4>
<h2>Raw span JSON</h2>
<textarea style="width: 100%;height: 200px;" id="jsonInput" placeholder="Paste your JSON here..."></textarea>
<br>
<button onclick="generateURL()">Generate URL</button>
<a id="generatedLink" href="#" target="_blank" style="display:none;">show Perf-genie profile</a>
<p id="help"></p>
<script type="text/javascript" class="init">
    function generateURL(){

        const input = document.getElementById("jsonInput").value;
        const link = document.getElementById("generatedLink");
        const help = document.getElementById("help");
        try {
        const jsonData = JSON.parse(input);

        const ts = jsonData.timestamp_millis;
            const duration = jsonData.duration;
            const threadId = jsonData.tags?.threadId;
            const host = jsonData.tags?.["sfdc.device"];
            const dc = jsonData.tags?.["sfdc.dc"];
            const fdi = jsonData.tags?.["functional_domain_instance"];
            const pod = jsonData.tags?.["sfdc.pod"];

            if(duration != undefined && threadId != undefined && host != undefined && dc != undefined && fdi != undefined && pod!=undefined ) {
                const startTime = ts - 60000;
                const endTime = ts + 15 * 60 * 1000;

                const tenant = "falcon-" + dc + "-" + fdi + "-" + pod;
                const pStart = ts;
                const pEnd = ts + Math.floor(duration / 1000);

                const filterBy = "tid%3D" + threadId + "%3BpStart%3D" + pStart + "%3BpEnd%3D" + pEnd + "%3B";

                const url = "https://perf-genie.sfproxy.monitoring.dev1-uswest2.aws.sfdc.cl/?startTime1=" + startTime +
                    "&endTime1=" + endTime +
                    "&host1=" + host +
                    "&tenant1=" + tenant +
                    "&profile1=All" +
                    "&types=jfr_dump.json.gz%3Ajson-jstack%3Ajfr_dump_apex.json.gz%3Ajfr_dump_socket.json.gz%3A" +
                    "&events=jfr_dump_log.json.gz%3A" +
                    "&groupBy=All%20records" +
                    "&filterBy=" + filterBy +
                    "&dataSource=other#cct";

                link.href = url;
                link.style.display = "inline";
                link.textContent = "show Perf-genie profile";
            }else{
                help.innerHTML = "missing needed input values";
            }

        } catch (e) {
            help.innerHTML = "Error parsing JSON: " + e.message;
        }
    }
</script>