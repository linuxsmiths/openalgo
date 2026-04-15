import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

os.environ["LATENCY_DATABASE_URL"] = "sqlite:///:memory:"


def setup_latency_db():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import scoped_session, sessionmaker

    import database.latency_db as latency_mod

    engine = create_engine("sqlite:///:memory:")
    latency_mod.latency_engine = engine
    latency_mod.latency_session = scoped_session(
        sessionmaker(autocommit=False, autoflush=False, bind=engine)
    )
    latency_mod.LatencyBase.query = latency_mod.latency_session.query_property()
    latency_mod.LatencyBase.metadata.create_all(engine)

    return latency_mod


def test_log_latency_serializes_structured_error_payload():
    latency_mod = setup_latency_db()
    error_payload = {
        "exchange": [
            "Must be one of: NSE, NFO, CDS, BSE, BFO, BCD, MCX, NCDEX, NSE_INDEX, BSE_INDEX, CRYPTO."
        ]
    }

    success = latency_mod.OrderLatency.log_latency(
        order_id="unknown",
        user_id=None,
        broker="angel",
        symbol="EICHERMOT",
        order_type="DEPTH",
        latencies={
            "rtt": 0.34,
            "validation": 0.08,
            "broker_response": 0.04,
            "overhead": 0.12,
            "total": 0.47,
        },
        request_body=None,
        response_body=None,
        status="FAILED",
        error=error_payload,
    )

    assert success is True

    log = latency_mod.OrderLatency.query.one()
    assert isinstance(log.error, str)
    assert json.loads(log.error) == error_payload

    latency_mod.latency_session.remove()


def test_log_latency_preserves_string_error_message():
    latency_mod = setup_latency_db()

    success = latency_mod.OrderLatency.log_latency(
        order_id="unknown",
        user_id=None,
        broker="angel",
        symbol="EICHERMOT",
        order_type="QUOTES",
        latencies={
            "rtt": 0.60,
            "validation": 0.07,
            "broker_response": 0.05,
            "overhead": 0.12,
            "total": 0.72,
        },
        request_body=None,
        response_body=None,
        status="FAILED",
        error="Invalid exchange",
    )

    assert success is True

    log = latency_mod.OrderLatency.query.one()
    assert log.error == "Invalid exchange"

    latency_mod.latency_session.remove()
