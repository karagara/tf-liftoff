variable "project_prefix" {}

resource "aws_s3_bucket" "state_bucket" {
  bucket = "${var.project_prefix}-state"
}

resource "aws_s3_bucket_acl" "private_acl" {
  bucket = aws_s3_bucket.state_bucket.id
  acl    = "private"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "sse" {
  bucket = aws_s3_bucket.state_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_dynamodb_table" "state_lock_table" {
  name           = "${var.project_prefix}-state-lock-table"
  hash_key       = "LockID"
  read_capacity  = 2
  write_capacity = 2

  server_side_encryption {
    enabled = true
  }

  attribute {
    name = "LockID"
    type = "S"
  }
}
