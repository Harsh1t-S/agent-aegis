# Self-hosted model runbook

Aegis can run without a paid model API. The evaluation queue is stored in
Postgres, while an outbound worker calls a private Ollama container. The browser
and API never connect to Ollama directly.

## Choose the cheapest useful stage

1. Use the deterministic behavioral adapter while building the product. It is
   free, fast and repeatable, but it is a software fixture rather than evidence
   of how a real model behaves.
2. Run `qwen3.5:4b` on a local NVIDIA GPU for development and early pilots. This
   is the closest option to free because it uses hardware you already own.
3. Start an EC2 GPU only when a customer evaluation is queued. Stop it after the
   queue drains. AWS has no generally free GPU instance; an idle stopped instance
   still incurs EBS storage charges.
4. Use Spot only after confirming that interrupted jobs recover safely. Aegis
   leases every queue job, so another worker can reclaim it after the lease
   expires, but the interruption still adds delay.

Do not train a foundation model. A small pretrained tool-capable model is enough
to validate the hosting path. Fine-tuning becomes useful only after Aegis has a
representative, human-labeled dataset and a held-out benchmark.

## Run on a local NVIDIA machine

Prerequisites are Docker Desktop, current NVIDIA drivers, the NVIDIA Container
Toolkit integration, and access to the production or staging Postgres database.

```powershell
Copy-Item .env.worker.example .env.worker
# Edit DATABASE_URL and AEGIS_SECRET_ENCRYPTION_KEY in .env.worker.
docker compose --env-file .env.worker -f docker-compose.inference.yml up -d --build
docker compose --env-file .env.worker -f docker-compose.inference.yml ps
docker compose --env-file .env.worker -f docker-compose.inference.yml logs -f worker
```

The first start downloads the model. Ollama listens only on the private Compose
network. Confirm that no host port maps to `11434` in `docker compose ps`.

If the 4B model spills into system memory, set this in `.env.worker`:

```dotenv
AEGIS_LOCAL_MODEL=qwen3.5:2b
```

Stop compute while retaining the downloaded model:

```powershell
docker compose --env-file .env.worker -f docker-compose.inference.yml down
```

Do not add `-v`; that would remove the model volume and force another download.

## Run an AWS pilot worker

For a first pilot, `g4dn.xlarge` provides one NVIDIA T4 with 16 GB of GPU memory.
A current G6 instance provides more headroom but may cost more and is not present
in every region. Confirm current availability and pricing in the target region
before launch.

1. Launch a supported NVIDIA GPU instance from a current AWS Deep Learning Base
   GPU AMI. Use an encrypted EBS volume large enough for Docker layers and model
   files.
2. Attach an IAM role that permits Systems Manager. Use Session Manager for
   administration and leave the security group with no inbound application or SSH
   ports. The worker only needs outbound HTTPS, DNS and Postgres connectivity.
3. Store `DATABASE_URL`, `AEGIS_SECRET_ENCRYPTION_KEY` and optional Resend values
   outside Git. Restrict the database user to the Aegis runtime role.
4. Clone the exact release commit, create `.env.worker`, and start the same Compose
   stack used locally.
5. Run one behavioral evaluation and one human-reviewed model evaluation. Verify
   the model name, scenario-set hash, token counts and worker identity in the
   resulting report.
6. Stop the instance after `python -m app.maintenance status` reports no queued,
   running, expired or failed jobs. Keep the encrypted EBS volume if avoiding a
   model download on the next start is worth its storage cost.

Useful checks on the host:

```bash
nvidia-smi
docker compose --env-file .env.worker -f docker-compose.inference.yml ps
docker compose --env-file .env.worker -f docker-compose.inference.yml exec ollama ollama ps
python -m app.maintenance status
```

Spot instances can be interrupted with short notice. Use them only for retryable
evaluation work, keep durable state in Postgres, and never store the only copy of
customer evidence on instance-local storage.

## Validate before changing the default model

Create a benchmark from reviewed traces and keep a held-out test split that is
never used for tuning:

```bash
python -m app.benchmark aegis-reviewed-benchmark-YYYY-MM-DD.json
```

Compare the candidate against the current model on the exact same immutable
scenario set. Check tool-call validity, critical misses, false-positive rate,
latency and cost. Promote it only when the held-out result meets the release
threshold; model size or a successful demo is not enough.

If there are enough reviewed examples to justify LoRA training, remove secrets
and customer identifiers, split by customer and scenario family, train only on
the training split, and preserve the untouched test split. Version the adapter,
base model, dataset hash and training parameters. The evaluator must never train
on the same examples used to claim its accuracy.

Official references:

- [Ollama Docker deployment](https://docs.ollama.com/docker)
- [Ollama OpenAI-compatible API](https://docs.ollama.com/api/openai-compatibility)
- [Qwen 3.5 model tags](https://ollama.com/library/qwen3.5)
- [AWS accelerated-computing instance specifications](https://aws.amazon.com/ec2/instance-types/accelerated-computing/)
- [AWS Systems Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/what-is-systems-manager.html)
- [Amazon EBS encryption](https://docs.aws.amazon.com/ebs/latest/userguide/how-ebs-encryption-works.html)
- [EC2 Spot interruptions](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/spot-interruptions.html)
