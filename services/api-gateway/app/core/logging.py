import logging
import sys

from app.core.config import settings


def configure_logging() -> None:
    level = logging.DEBUG if settings.environment == "development" else logging.INFO
    handler = logging.StreamHandler(sys.stdout)
    fmt = "%(asctime)s %(levelname)s %(name)s %(message)s"
    if settings.environment == "production":
        import json

        class JsonFormatter(logging.Formatter):
            def format(self, record: logging.LogRecord) -> str:
                log_record = {
                    "ts": self.formatTime(record),
                    "level": record.levelname,
                    "logger": record.name,
                    "msg": record.getMessage(),
                }
                if record.exc_info:
                    log_record["exc"] = self.formatException(record.exc_info)
                return json.dumps(log_record)

        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter(fmt))
    logging.basicConfig(level=level, handlers=[handler])
