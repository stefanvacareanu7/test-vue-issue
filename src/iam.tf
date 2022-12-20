data "aws_caller_identity" "current" {}
data "aws_iam_policy_document" "backup_assume_policy_document" {
  statement {
    actions = ["sts:AssumeRole"]
    effect  = "Allow"
    principals {
      type        = "Service"
      identifiers = ["backup.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "backup_policy_document" {
  statement {
    sid    = "DynamoDBBackupPolicy"
    effect  = "Allow"

    actions = [
      "dynamodb:DescribeTable",
      "dynamodb:CreateBackup",
      "dynamodb:ListTagsOfResource",
      "dynamodb:StartAwsBackupJob",
      "dynamodb:RestoreTableFromAwsBackup"
    ]

    resources = var.dynamodb_tables_arn

  }

  statement {
    sid    = "DynamoDBBackupAndRestorePolicy"
    effect  = "Allow"

    actions = [
      "dynamodb:DescribeBackup",
      "dynamodb:RestoreTableFromBackup"
    ]

    resources = ["arn:aws:dynamodb:${var.region}:${data.aws_caller_identity.current.account_id}:table/*/backup/*"]

  }

  statement {
    sid    = "DynamoDBVaultPolicy"
    effect  = "Allow"

    actions = [
      "backup:DescribeBackupVault",
      "backup:CopyIntoBackupVault"
    ]

    resources = [
      local.dynamodb-backup-vault-region-map[var.region][0].arn,
      "arn:aws:backup:*:${module.global-variables.df_gameday_account}:backup-vault:*"
    ]

  }

  statement {
    effect  = "Allow"

    actions = [
      "backup:CopyFromBackupVault"
    ]

    resources = [aws_backup_vault.dynamodb_backup_vault.arn]

  }

}

resource "aws_backup_vault_policy" "backup_vault_policy_gameday" {
  count = var.environment == module.global-variables.df_gameday_env ? 1 : 0

  backup_vault_name = aws_backup_vault.dynamodb_backup_vault

  policy = <<POLICY
{
  "Version": "2012-10-17",
  "Id": "default",
  "Statement": [
    {
      "Sid": "default",
      "Effect": "Allow",
      "Principal": {
        "AWS": [arn:aws:iam::${module.global-variables.df_prod_account}:root",
                  arn:aws:iam::${module.global-variables.df_stg_account}:root"]
      },
      "Action": "backup:CopyIntoBackupVault",
      "Resource": "*"
    }
  ]
}
POLICY
}

resource "aws_iam_policy" "backup_policy" {
  name = "${var.service_name}-${var.environment}-dynamodb-backup-policy-${var.environment_region}"
  policy = data.aws_iam_policy_document.backup_policy_document.json
}

resource "aws_iam_role" "backup_role" {
  name               = "${var.service_name}-${var.environment}-dynamodb-backup-role-${var.environment_region}"
  assume_role_policy = data.aws_iam_policy_document.backup_assume_policy_document.json
}

resource "aws_iam_role_policy_attachment" "backup" {
  policy_arn = aws_iam_policy.backup_policy.arn
  role       = aws_iam_role.backup_role.name
}

