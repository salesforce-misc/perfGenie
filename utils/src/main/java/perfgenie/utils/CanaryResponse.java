package perfgenie.utils;

import java.util.List;

public class CanaryResponse {
    public List<String> getHeader() {
        return header;
    }

    public void setHeader(List<String> header) {
        this.header = header;
    }

    List<String> header;

    public List<Object> getRecord() {
        return record;
    }

    public void setRecord(List<Object> record) {
        this.record = record;
    }

    List<Object> record;
    public CanaryResponse(List<String> header, List<Object> record){
        this.record=record;
        this.header=header;
    }
}
