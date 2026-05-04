# PostgreSQL 部署教程（DB 模式必读）

后端只要检测到 `DATABASE_URL` 就会进入 DB 模式，并在启动阶段自动跑 migrations。

本文档提供两种 PostgreSQL 部署方式：
- Docker（最快）
- 原生安装（生产更可控）

## A. Docker 部署 PostgreSQL（最快）

在 `backend/` 目录已有 `docker-compose.yml` 可用于本地/服务器快速拉起。

```bash
cd backend
docker compose up -d
docker compose ps
```

默认连接串示例（按你实际 compose 配置为准）：

```bash
export DATABASE_URL='postgres://awesome_iwb:awesome_iwb_dev@127.0.0.1:5432/awesome_iwb'
```

## B. Linux 原生安装 PostgreSQL（推荐生产）

以 Debian/Ubuntu 为例：

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

### 1) 创建数据库与用户

```bash
sudo -u postgres psql <<'SQL'
create user awesome_iwb with password 'PLEASE_CHANGE_ME';
create database awesome_iwb owner awesome_iwb;
grant all privileges on database awesome_iwb to awesome_iwb;
SQL
```

### 2) 绑定监听与访问控制

生产建议只监听本机：

- `postgresql.conf`：`listen_addresses = '127.0.0.1'`
- `pg_hba.conf`：只允许本机连接

修改后重启：

```bash
sudo systemctl restart postgresql
```

### 3) 配置 DATABASE_URL

```bash
export DATABASE_URL='postgres://awesome_iwb:PLEASE_CHANGE_ME@127.0.0.1:5432/awesome_iwb'
```

如果你用 systemd（推荐），把它写入环境文件（例）：

`/etc/awesome-iwb/backend.env`

```bash
DATABASE_URL=postgres://awesome_iwb:PLEASE_CHANGE_ME@127.0.0.1:5432/awesome_iwb
```

权限：

```bash
sudo chmod 600 /etc/awesome-iwb/backend.env
```

### 4) 验证连接

```bash
psql "$DATABASE_URL" -c 'select now();'
```

## C. 备份与恢复（基础）

### 备份

```bash
pg_dump "$DATABASE_URL" -Fc -f awesome_iwb.dump
```

### 恢复

```bash
pg_restore -d "$DATABASE_URL" --clean --if-exists awesome_iwb.dump
```

## D. 常见问题

### 1) migrations 会不会重复跑？

不会。migrations 表会记录已执行的脚本。

### 2) 我想把 PostgreSQL 暴露给外网可以吗？

不建议。最安全的做法是：
- PostgreSQL 只监听本机/内网
- 远程管理通过 SSH 隧道或内网访问

