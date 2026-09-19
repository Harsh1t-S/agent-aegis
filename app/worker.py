"""Durable Aegis evaluation worker.

Run with: python -m app.worker
Use --once in health checks and CI.
"""
from __future__ import annotations

import argparse
import os
import socket
import time

from .engine import claim_next_job, execute_job


def main() -> None:
    parser = argparse.ArgumentParser(description="Process Aegis evaluation jobs")
    parser.add_argument("--once", action="store_true",
                        help="process at most one job and exit")
    parser.add_argument("--poll-seconds", type=float,
                        default=float(os.getenv("WORKER_POLL_SECONDS", "2")))
    args = parser.parse_args()
    worker_id = os.getenv(
        "WORKER_ID", f"{socket.gethostname()}:{os.getpid()}")
    while True:
        job_id = claim_next_job(worker_id)
        if job_id:
            execute_job(job_id)
        elif args.once:
            return
        else:
            time.sleep(max(args.poll_seconds, 0.2))
        if args.once:
            return


if __name__ == "__main__":
    main()
