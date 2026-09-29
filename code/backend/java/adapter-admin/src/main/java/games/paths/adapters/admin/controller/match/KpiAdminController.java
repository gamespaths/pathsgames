package games.paths.adapters.admin.controller.match;

import games.paths.core.port.match.KpiPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * KpiAdminController - v0.41.2 Step 41 F: GET /api/admin/reports/kpi, the daily UTC KPI counters per story
 * grouped by day, month or total (admin port only, ADMIN role like every /api/admin/** route).
 */
@RestController
@RequestMapping("/api/admin/reports")
public class KpiAdminController {

    private final KpiPort kpiPort;

    public KpiAdminController(KpiPort kpiPort) {
        this.kpiPort = kpiPort;
    }

    @GetMapping("/kpi")
    public ResponseEntity<Object> kpi(@RequestParam(required = false) String storyUuid,
                                      @RequestParam(required = false) String from,
                                      @RequestParam(required = false) String to,
                                      @RequestParam(required = false) String groupBy) {
        try {
            return ResponseEntity.ok(toBody(kpiPort.report(storyUuid, from, to, groupBy)));
        } catch (KpiPort.KpiException ex) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("error", ex.getCode());
            body.put("message", ex.getMessage());
            body.put("timestamp", System.currentTimeMillis());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
        }
    }

    static Map<String, Object> toBody(KpiPort.KpiReport r) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("storyUuid", r.storyUuid());
        body.put("from", r.from());
        body.put("to", r.to());
        body.put("groupBy", r.groupBy());
        body.put("rows", r.rows().stream().map(KpiAdminController::row).toList());
        body.put("choices", counts(r.choices()));
        body.put("locations", counts(r.locations()));
        body.put("missions", r.missions().stream().map(m -> {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("uuid", m.uuid());
            out.put("activated", m.activated());
            out.put("completed", m.completed());
            out.put("failed", m.failed());
            return out;
        }).toList());
        return body;
    }

    private static Map<String, Object> row(KpiPort.KpiRow k) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("period", k.period());
        out.put("matchesStarted", k.matchesStarted());
        out.put("matchesCompleted", k.matchesCompleted());
        out.put("completionRate", k.completionRate());
        out.put("avgDurationMinutes", k.avgDurationMinutes());
        out.put("avgDurationClocks", k.avgDurationClocks());
        out.put("comaCount", k.comaCount());
        return out;
    }

    private static List<Map<String, Object>> counts(List<KpiPort.KpiCount> list) {
        return list.stream().map(c -> {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("uuid", c.uuid());
            out.put("count", c.count());
            return out;
        }).toList();
    }
}
