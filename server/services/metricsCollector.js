const { MetricsCollector, METRICS_KEY } = require('./metricsRecorder');
const { buildReport } = require('./metricsReport');

class MetricsCollectorWithReport extends MetricsCollector {
    async getReport() {
        const metrics = await this._getMetrics();
        return buildReport(metrics);
    }
}

function getMetrics(projectId) {
    return new MetricsCollectorWithReport(projectId);
}

module.exports = { MetricsCollector: MetricsCollectorWithReport, getMetrics, METRICS_KEY };
