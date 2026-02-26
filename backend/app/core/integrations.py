"""
External integration clients for WordPress REST API, LinkedIn UGC API, and Klenty.
"""

import requests
from dataclasses import dataclass
from typing import Optional


class IntegrationError(Exception):
    """Raised when an external integration call fails."""
    pass


# ─────────────────────────────────────────────────────────────
# WordPress
# ─────────────────────────────────────────────────────────────

@dataclass
class WordPressConfig:
    site_url: str       # e.g. "https://example.com"
    username: str
    app_password: str
    publish_status: str = "draft"  # "draft" or "publish"


def publish_to_wordpress(config: WordPressConfig, blog_data: dict) -> dict:
    """
    Publish a blog post via WordPress REST API.
    Returns dict with 'id', 'link', 'status'.
    """
    url = config.site_url.rstrip("/") + "/wp-json/wp/v2/posts"

    payload = {
        "title": blog_data.get("title", "Untitled"),
        "content": blog_data.get("content_html", ""),
        "slug": blog_data.get("slug", ""),
        "status": config.publish_status,
        "excerpt": blog_data.get("meta_description", ""),
    }

    try:
        resp = requests.post(
            url,
            json=payload,
            auth=(config.username, config.app_password),
            timeout=30,
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "id": data.get("id"),
            "link": data.get("link", ""),
            "status": data.get("status", ""),
        }
    except requests.exceptions.ConnectionError:
        raise IntegrationError(
            f"Cannot connect to WordPress at {config.site_url}. Check the site URL."
        )
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else "?"
        detail = ""
        try:
            detail = e.response.json().get("message", "")
        except Exception:
            pass
        if status == 401:
            raise IntegrationError(
                "WordPress authentication failed (401). Check your username and application password."
            )
        elif status == 403:
            raise IntegrationError(
                "WordPress authorization denied (403). Ensure the user has 'publish_posts' capability."
            )
        raise IntegrationError(f"WordPress API error ({status}): {detail or str(e)}")
    except Exception as e:
        raise IntegrationError(f"WordPress publishing failed: {str(e)[:200]}")


def test_wordpress_connection(config: WordPressConfig) -> dict:
    """
    Test WordPress connection by fetching site info via REST API.
    Returns dict with site title and url on success.
    """
    url = config.site_url.rstrip("/") + "/wp-json"
    try:
        resp = requests.get(url, auth=(config.username, config.app_password), timeout=15)
        resp.raise_for_status()
        data = resp.json()
        return {
            "success": True,
            "site_name": data.get("name", "Unknown"),
            "site_url": data.get("url", config.site_url),
            "message": f"Connected to '{data.get('name', 'WordPress site')}'",
        }
    except requests.exceptions.ConnectionError:
        return {"success": False, "message": f"Cannot connect to {config.site_url}"}
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else "?"
        return {"success": False, "message": f"WordPress returned HTTP {status}"}
    except Exception as e:
        return {"success": False, "message": str(e)[:200]}


# ─────────────────────────────────────────────────────────────
# LinkedIn
# ─────────────────────────────────────────────────────────────

@dataclass
class LinkedInConfig:
    access_token: str
    author_urn: str     # e.g. "urn:li:person:xxxxxx" or "urn:li:organization:xxxxxx"


def post_to_linkedin(config: LinkedInConfig, post_text: str, blog_url: Optional[str] = None) -> dict:
    """
    Post content to LinkedIn via the UGC API.
    Returns dict with post URN on success.
    """
    headers = {
        "Authorization": f"Bearer {config.access_token}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
    }

    # Build share content
    share_content: dict = {
        "shareCommentary": {"text": post_text},
        "shareMediaCategory": "NONE",
    }

    # If blog URL provided, attach as an article
    if blog_url:
        share_content["shareMediaCategory"] = "ARTICLE"
        share_content["media"] = [
            {
                "status": "READY",
                "originalUrl": blog_url,
            }
        ]

    payload = {
        "author": config.author_urn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": share_content,
        },
        "visibility": {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
    }

    try:
        resp = requests.post(
            "https://api.linkedin.com/v2/ugcPosts",
            json=payload,
            headers=headers,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "post_urn": data.get("id", ""),
            "message": "Posted to LinkedIn successfully",
        }
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else "?"
        detail = ""
        try:
            detail = e.response.json().get("message", "")
        except Exception:
            pass
        if status == 401:
            raise IntegrationError(
                "LinkedIn authentication failed (401). Your access token may be expired. "
                "LinkedIn tokens expire after 60 days."
            )
        elif status == 403:
            raise IntegrationError(
                "LinkedIn authorization denied (403). Ensure your app has 'w_member_social' permission."
            )
        raise IntegrationError(f"LinkedIn API error ({status}): {detail or str(e)}")
    except Exception as e:
        raise IntegrationError(f"LinkedIn posting failed: {str(e)[:200]}")


# ─────────────────────────────────────────────────────────────
# Klenty
# ─────────────────────────────────────────────────────────────

@dataclass
class KlentyConfig:
    api_key: str
    user_email: str
    campaign_a_name: str = "Campaign A"
    campaign_b_name: str = "Campaign B"
    campaign_c_name: str = "Campaign C"


def add_prospect_to_klenty(
    config: KlentyConfig,
    email: str,
    name: Optional[str],
    company: Optional[str],
    campaign_name: str,
) -> dict:
    """
    Add a prospect to a Klenty campaign.
    Returns dict with success status and prospect_id on success.
    Raises IntegrationError on failure.
    """
    # Split name into first/last
    first_name = ""
    last_name = ""
    if name:
        parts = name.strip().split(" ", 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""

    url = f"https://app.klenty.com/apis/v1/user/{config.user_email}/prospects"
    headers = {
        "x-API-key": config.api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "Email": email,
        "FirstName": first_name,
        "LastName": last_name,
        "Company": company or "",
        "CampaignName": campaign_name,
    }
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=20)
        resp.raise_for_status()
        data = resp.json()
        return {
            "success": True,
            "prospect_id": data.get("id", ""),
            "message": f"Enrolled {email} in Klenty campaign '{campaign_name}'",
        }
    except requests.exceptions.ConnectionError:
        raise IntegrationError("Cannot connect to Klenty. Check your network or Klenty service status.")
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else "?"
        detail = ""
        try:
            detail = e.response.json().get("message", "")
        except Exception:
            pass
        if status == 401:
            raise IntegrationError("Klenty authentication failed (401). Check your API key.")
        elif status == 403:
            raise IntegrationError("Klenty authorization denied (403). Check your API key permissions.")
        elif status == 404:
            raise IntegrationError(
                f"Klenty campaign '{campaign_name}' not found (404). "
                "Check the campaign name in Settings matches exactly."
            )
        raise IntegrationError(f"Klenty API error ({status}): {detail or str(e)}")
    except Exception as e:
        raise IntegrationError(f"Klenty prospect enrollment failed: {str(e)[:200]}")


def test_klenty_connection(config: KlentyConfig) -> dict:
    """
    Test Klenty connection by listing sequences (campaigns) for the user account.
    Returns dict with success status and message.
    """
    url = f"https://app.klenty.com/apis/v1/user/{config.user_email}/sequences"
    headers = {"x-API-key": config.api_key}
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        campaigns = data if isinstance(data, list) else data.get("sequences", [])
        count = len(campaigns)
        return {
            "success": True,
            "campaigns_found": count,
            "message": f"Connected to Klenty. Found {count} campaign(s) for {config.user_email}.",
        }
    except requests.exceptions.ConnectionError:
        return {"success": False, "message": "Cannot connect to Klenty. Check your network."}
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else "?"
        if status == 401:
            return {"success": False, "message": "Invalid Klenty API key (401)."}
        return {"success": False, "message": f"Klenty returned HTTP {status}"}
    except Exception as e:
        return {"success": False, "message": str(e)[:200]}


# ─────────────────────────────────────────────────────────────
# Outplay
# ─────────────────────────────────────────────────────────────

@dataclass
class OutplayConfig:
    api_key: str
    sequence_name_a: str = "Travel Fit Sequence"    # Fit clients (score > 70)
    sequence_name_b: str = "Warm Lead Sequence"     # Warm leads
    sequence_name_c: str = "Cold Lead Sequence"     # Cold leads


def add_prospect_to_outplay(
    config: OutplayConfig,
    email: str,
    name: Optional[str],
    company: Optional[str],
    sequence_name: str,
) -> dict:
    """
    Add a prospect to an Outplay sequence.
    Returns dict with success status on success.
    Raises IntegrationError on failure.
    """
    first_name = ""
    last_name = ""
    if name:
        parts = name.strip().split(" ", 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""

    url = "https://api.outplayhq.com/api/v2/prospect"
    headers = {
        "x-api-key": config.api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "email": email,
        "first_name": first_name,
        "last_name": last_name,
        "company": company or "",
        "sequence_name": sequence_name,
    }
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=20)
        resp.raise_for_status()
        data = resp.json()
        return {
            "success": True,
            "prospect_id": data.get("id", ""),
            "message": f"Enrolled {email} in Outplay sequence '{sequence_name}'",
        }
    except requests.exceptions.ConnectionError:
        raise IntegrationError("Cannot connect to Outplay. Check your network or Outplay service status.")
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else "?"
        detail = ""
        try:
            detail = e.response.json().get("message", "")
        except Exception:
            pass
        if status == 401:
            raise IntegrationError("Outplay authentication failed (401). Check your API key.")
        elif status == 403:
            raise IntegrationError("Outplay authorization denied (403). Check your API key permissions.")
        elif status == 404:
            raise IntegrationError(
                f"Outplay sequence '{sequence_name}' not found (404). "
                "Check the sequence name in Settings matches exactly."
            )
        raise IntegrationError(f"Outplay API error ({status}): {detail or str(e)}")
    except Exception as e:
        raise IntegrationError(f"Outplay prospect enrollment failed: {str(e)[:200]}")


def test_outplay_connection(config: OutplayConfig) -> dict:
    """
    Test Outplay connection by listing sequences for the account.
    Returns dict with success status and message.
    """
    url = "https://api.outplayhq.com/api/v2/sequence"
    headers = {"x-api-key": config.api_key}
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        sequences = data if isinstance(data, list) else data.get("sequences", data.get("data", []))
        count = len(sequences) if isinstance(sequences, list) else 0
        return {
            "success": True,
            "sequences_found": count,
            "message": f"Connected to Outplay. Found {count} sequence(s).",
        }
    except requests.exceptions.ConnectionError:
        return {"success": False, "message": "Cannot connect to Outplay. Check your network."}
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else "?"
        if status == 401:
            return {"success": False, "message": "Invalid Outplay API key (401)."}
        return {"success": False, "message": f"Outplay returned HTTP {status}"}
    except Exception as e:
        return {"success": False, "message": str(e)[:200]}


def test_linkedin_connection(config: LinkedInConfig) -> dict:
    """
    Test LinkedIn connection by fetching the user's profile.
    """
    headers = {
        "Authorization": f"Bearer {config.access_token}",
        "X-Restli-Protocol-Version": "2.0.0",
    }
    try:
        resp = requests.get(
            "https://api.linkedin.com/v2/me",
            headers=headers,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        name_parts = []
        if data.get("localizedFirstName"):
            name_parts.append(data["localizedFirstName"])
        if data.get("localizedLastName"):
            name_parts.append(data["localizedLastName"])
        name = " ".join(name_parts) or "LinkedIn User"
        return {
            "success": True,
            "name": name,
            "message": f"Connected as {name}",
        }
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else "?"
        if status == 401:
            return {"success": False, "message": "Invalid or expired access token (401)"}
        return {"success": False, "message": f"LinkedIn returned HTTP {status}"}
    except Exception as e:
        return {"success": False, "message": str(e)[:200]}
