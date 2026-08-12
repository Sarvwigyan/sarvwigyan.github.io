# 🔐 Security Policy for Sarvwigyan

Sarvwigyan is an open knowledge ecosystem aiming to serve humanity through science, technology, philosophy, and truth. As such, the **security, integrity, and safety of the platform and its users are of paramount importance**.

This document outlines how you can **report vulnerabilities**, what kinds of threats we monitor, and how we responsibly handle and disclose security issues.

---

## 📅 Supported Versions

| Version        | Supported          | Security Updates |
|----------------|--------------------|------------------|
| `main` branch  | ✅ Yes              | ✅ Yes           |
| Archived/Old branches | ❌ No             | ❌ No            |

We only support the latest version of Sarvwigyan and actively maintain the `main` branch. Please ensure you're working on up-to-date code when reporting vulnerabilities.

---

## 📢 How to Report a Security Issue

If you believe you’ve found a security vulnerability in **Sarvwigyan**, its website, services, code, or data:

- 🚨 **DO NOT publicly disclose the issue**.
- 📧 **Privately email us at:** `sarvwigyan@protonmail.com`  
- 📄 Please include:
  - A detailed description of the vulnerability
  - Steps to reproduce
  - The scope and potential impact
  - Any logs, screenshots, or proof-of-concept code (if applicable)

> We appreciate responsible disclosures and aim to respond within **48 hours**.

---

## 🛡️ Types of Security Issues We Care About

We are especially concerned about issues that may affect:

### 1. 🧠 User Data and Privacy
- Unauthorized access to user-submitted content
- Exposure of personal or sensitive data
- Insecure storage of files or text
- Indexing of private files

### 2. 🔐 Authentication and Authorization
- Bypass of login systems (if implemented in the future)
- Broken access controls
- Session hijacking or insecure cookies

### 3. ⚙️ Code Vulnerabilities
- Code injection (XSS, SQLi, Shell Injection)
- Remote Code Execution (RCE)
- Insecure deserialization
- Use of deprecated libraries with known CVEs
- Logic flaws in backend code or business rules

### 4. 🌐 Frontend/Web Threats
- Cross-Site Scripting (XSS)
- Cross-Site Request Forgery (CSRF)
- Clickjacking
- Insecure CORS headers or policies

### 5. 🧬 AI/ML Risks (Present or Future)
- Prompt injections
- Model poisoning or jailbreaks
- Leakage of training data or embeddings

### 6. 📦 Supply Chain Issues
- Malicious or compromised dependencies
- Typosquatting in package managers
- Insecure GitHub Actions or CI/CD workflows

### 7. 💣 Infrastructure or Hosting Risks
- Exposure of GitHub Secrets/API Keys
- Public access to internal configurations
- Denial-of-Service vulnerabilities

---

## ❌ Out of Scope

While we appreciate curiosity and creativity, the following are **not considered security issues** unless they demonstrate a realistic attack vector:

- Missing `security.txt`
- Lack of CAPTCHA
- Rate limiting or brute-force attempts without real impact
- Use of outdated libraries **without** exploitable CVEs
- Email spoofing without a working exploit
- UI/UX bugs or typos

---

## 🧭 Responsible Disclosure & Rewards

We value researchers who help secure our systems. If you report a **valid and impactful vulnerability**, we will:

- Publicly acknowledge your contribution (if you wish)
- Offer a badge or certificate of ethical contribution
- Consider small monetary rewards or feature shout-outs in our project

We follow the [RFPolicy](https://github.com/bugcrowd/disclosure-policy) standard for disclosure timelines.

---

## 🔐 Our Internal Security Practices

We follow strict internal security protocols including:

- 🔒 HTTPS/TLS encryption everywhere
- 🧪 Code linting and static analysis for every PR
- 🛑 Secrets scanning using GitHub Security
- 👥 Role-based access control for all collaborators
- 🔄 Regular dependency audits (`npm audit`, `pip-audit`, `Dependabot`)
- 🧬 Planning ML model security for future features
- 🧭 Transparent and traceable commit logs

---

## 🛠 Tools We Use for Security

- **[Dependabot](https://docs.github.com/en/code-security/dependabot)** for dependency alerts
- **[CodeQL](https://codeql.github.com/)** for code scanning
- **[Bandit](https://bandit.readthedocs.io/)** for Python security issues
- **[OWASP ZAP](https://www.zaproxy.org/)** for manual web app scanning
- **Custom Bash/Python Scripts** for scanning content and logs

---

## 🌐 Reporting Security in Dependencies

If the vulnerability exists in a **third-party library** used in Sarvwigyan:

1. First report it to the upstream maintainer (e.g., library repo).
2. Then notify us if it affects Sarvwigyan’s functionality or user safety.

---

## 📜 Licensing and Legal

All security research on Sarvwigyan must follow:
- [GitHub's Acceptable Use Policies](https://docs.github.com/en/site-policy/github-terms/github-acceptable-use-policies)
- [Indian IT Act](https://en.wikipedia.org/wiki/Information_Technology_Act,_2000)
- Your local cybercrime laws

Do **not** perform destructive testing, DoS attacks, or data scraping on live users.

---

## 🙏 Thanks for Keeping Sarvwigyan Safe

Security is a **community effort**, and we deeply appreciate your help in making Sarvwigyan a secure, ethical, and open platform for knowledge and evolution.

Let us work together to build a platform that future generations can trust.

— *Sarvwigyan Core Team*
