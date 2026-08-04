# AWS S3 setup for project attachments

The Attachments feature (`src/attachments/`, `src/aws-s3/`) needs an S3
bucket and an IAM user scoped to it. Nothing on this machine has AWS
credentials configured, so this is a manual one-time step — the app runs
fine without it (uploads/downloads just fail with a clear 503 until it's
done), so this doesn't block anything else.

No bucket CORS configuration is needed: uploads and downloads both proxy
through the API (`multer` receives the file server-side, S3 is written to
directly; downloads are streamed back through the API too) — the browser
never talks to S3 directly.

## 1. Create the bucket

Pick a globally-unique name and a region close to your users/API.

```bash
aws s3api create-bucket \
  --bucket your-projectops-attachments \
  --region us-east-1
```

(For any region other than `us-east-1` you must also pass
`--create-bucket-configuration LocationConstraint=<region>`.)

Block all public access — every read goes through the API, never directly:

```bash
aws s3api put-public-access-block \
  --bucket your-projectops-attachments \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

## 2. Create an IAM user scoped to just this bucket

```bash
aws iam create-user --user-name projectops-attachments-service
```

Save this policy as `projectops-attachments-policy.json`, filling in the
bucket name:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ProjectOpsAttachments",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::your-projectops-attachments/*"
    }
  ]
}
```

Attach it:

```bash
aws iam put-user-policy \
  --user-name projectops-attachments-service \
  --policy-name projectops-attachments-access \
  --policy-document file://projectops-attachments-policy.json
```

Create an access key for that user:

```bash
aws iam create-access-key --user-name projectops-attachments-service
```

This prints an `AccessKeyId` and `SecretAccessKey` — copy both now, the
secret is shown only once.

## 3. Set the env vars

Add these to `api-project-ops/.env` (already templated in `.env.example`):

```bash
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-projectops-attachments
AWS_ACCESS_KEY_ID=<from step 2>
AWS_SECRET_ACCESS_KEY=<from step 2>
```

Restart the API. `S3Service` reads these at boot; if any are missing it logs
a warning and every attachment upload/download/delete throws a 503 ("File
storage is not configured on this server yet.") until they're all present —
the rest of the app is unaffected either way.

## 4. Verify

```bash
curl -s -X POST "http://localhost:3000/api/v1/projects/<projectId>/attachments" \
  -H "Authorization: Bearer <token>" \
  -H "x-workspace-slug: <slug>" \
  -F "file=@/path/to/some-file.pdf"
```

A successful response includes the new attachment's `id`. `GET
/projects/:projectId/attachments` should list it, and `GET
/projects/:projectId/attachments/:id/download` should return the file.
