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
    Test Outplay connection using a HEAD request on the prospect endpoint.
    Outplay does not expose a public GET/list endpoint — HEAD lets us verify auth
    without creating any data. Auth is checked server-side before the method matters:
      401 → bad key, 403 → bad permissions, anything else → key is valid.
    """
    url = "https://api.outplayhq.com/api/v2/prospect"
    headers = {"x-api-key": config.api_key}
    try:
        resp = requests.head(url, headers=headers, timeout=15)
        if resp.status_code == 401:
            return {"success": False, "message": "Invalid Outplay API key (401). Check your key."}
        if resp.status_code == 403:
            return {"success": False, "message": "Outplay authorization denied (403). Check your API key permissions."}
        # 200, 404, 405 are all fine — Outplay authenticates before checking the method
        return {
            "success": True,
            "message": "Connected to Outplay successfully. API key verified.",
        }
    except requests.exceptions.ConnectionError:
        return {"success": False, "message": "Cannot connect to Outplay. Check your network."}
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


# ─────────────────────────────────────────────────────────────
# LinkedIn Sales Navigator (SNAP API)
# ─────────────────────────────────────────────────────────────

@dataclass
class SalesNavigatorConfig:
    access_token: str      # OAuth2 access token with r_sales_nav_profile + r_sales_nav_search scopes
    count: int = 10        # Number of prospects to fetch per run


def search_sales_navigator_prospects(config: SalesNavigatorConfig, persona: str) -> list:
    """
    Search LinkedIn Sales Navigator via SNAP API for real B2B prospect profiles.
    Requires LinkedIn Sales Navigator Team/Enterprise plan + SNAP partner approval.
    Returns list of prospect dicts compatible with Agent 3's schema.
    """
    url = "https://api.linkedin.com/v2/salesNavigatorLeadSearches"
    headers = {
        "Authorization": f"Bearer {config.access_token}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
    }
    payload = {
        "query": {
            "filters": [
                {
                    "type": "CURRENT_TITLE",
                    "values": [{"text": persona, "selectionType": "INCLUDED"}],
                },
                {
                    "type": "INDUSTRY",
                    "values": [
                        {"text": "Travel and Tourism", "selectionType": "INCLUDED"},
                        {"text": "Hospitality", "selectionType": "INCLUDED"},
                        {"text": "Internet", "selectionType": "INCLUDED"},
                    ],
                },
            ]
        },
        "start": 0,
        "count": config.count,
    }
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        elements = data.get("elements", [])
        prospects = []
        for p in elements:
            positions = p.get("currentPositions") or []
            current = positions[0] if positions else {}
            name_parts = []
            fn = p.get("firstName", "")
            ln = p.get("lastName", "")
            if fn:
                name_parts.append(fn.lower())
            if ln:
                name_parts.append(ln.lower())
            # Build a guessed email if not provided (Sales Nav rarely returns emails)
            email = p.get("emailAddress", "")
            company_name = current.get("companyName", "")
            if not email and name_parts and company_name:
                domain_guess = company_name.lower().replace(" ", "").replace(",", "")[:20] + ".com"
                email = f"{'.'.join(name_parts[:2])}@{domain_guess}"
            prospect = {
                "id": str(_uuid.uuid4()),
                "first_name": fn,
                "last_name": ln,
                "email": email,
                "title": current.get("title", persona),
                "company": company_name,
                "company_type": "other",
                "website": "",
                "linkedin_url": p.get("publicProfileUrl", ""),
                "region": p.get("geoRegion", "Global"),
                "employees": "",
                "status": "raw",
                "source": "sales_navigator",
            }
            prospects.append(prospect)
        return prospects
    except requests.exceptions.ConnectionError:
        raise IntegrationError("Cannot connect to LinkedIn Sales Navigator API. Check your network.")
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else "?"
        detail = ""
        try:
            detail = e.response.json().get("message", "")
        except Exception:
            pass
        if status == 401:
            raise IntegrationError(
                "Sales Navigator authentication failed (401). Check your access token."
            )
        elif status == 403:
            raise IntegrationError(
                "Sales Navigator access denied (403). Your LinkedIn account may not have "
                "Sales Navigator Team/Enterprise plan or SNAP API partner access."
            )
        elif status == 422:
            raise IntegrationError(
                "Sales Navigator search rejected (422). Check persona/filter values."
            )
        raise IntegrationError(f"Sales Navigator API error ({status}): {detail or str(e)}")
    except Exception as e:
        raise IntegrationError(f"Sales Navigator search failed: {str(e)[:200]}")


def test_sales_navigator_connection(config: SalesNavigatorConfig) -> dict:
    """
    Test Sales Navigator connection by verifying the access token via /v2/me
    and then checking SNAP API access with a minimal search.
    """
    headers = {
        "Authorization": f"Bearer {config.access_token}",
        "X-Restli-Protocol-Version": "2.0.0",
    }
    # Step 1: verify token is valid
    try:
        me_resp = requests.get("https://api.linkedin.com/v2/me", headers=headers, timeout=15)
        me_resp.raise_for_status()
        me_data = me_resp.json()
        name = " ".join(filter(None, [
            me_data.get("localizedFirstName", ""),
            me_data.get("localizedLastName", ""),
        ])) or "LinkedIn User"
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else "?"
        if status == 401:
            return {"success": False, "message": "Invalid or expired access token (401)."}
        return {"success": False, "message": f"LinkedIn token check failed (HTTP {status})."}
    except Exception as e:
        return {"success": False, "message": f"Cannot connect to LinkedIn: {str(e)[:100]}"}

    # Step 2: verify SNAP API access with minimal search
    snap_url = "https://api.linkedin.com/v2/salesNavigatorLeadSearches"
    snap_headers = {**headers, "Content-Type": "application/json"}
    try:
        snap_resp = requests.post(
            snap_url,
            json={"query": {"filters": []}, "start": 0, "count": 1},
            headers=snap_headers,
            timeout=15,
        )
        if snap_resp.status_code == 403:
            return {
                "success": False,
                "message": (
                    f"Token valid (logged in as {name}), but Sales Navigator SNAP API access denied (403). "
                    "Requires Sales Navigator Team/Enterprise plan + LinkedIn SNAP partner approval."
                ),
            }
        snap_resp.raise_for_status()
        return {
            "success": True,
            "message": f"Connected as {name} — Sales Navigator SNAP API access confirmed.",
        }
    except requests.exceptions.HTTPError:
        # Already handled 403 above; other errors
        return {
            "success": False,
            "message": (
                f"Token valid (logged in as {name}), but Sales Navigator API check failed. "
                "Ensure your LinkedIn app has r_sales_nav_search scope."
            ),
        }
    except Exception as e:
        return {"success": False, "message": str(e)[:200]}


# ─────────────────────────────────────────────────────────────
# Apollo.io
# ─────────────────────────────────────────────────────────────

import uuid as _uuid

@dataclass
class ApolloConfig:
    api_key: str
    per_page: int = 10


def _apollo_employees_range(num) -> str:
    if not num:
        return "Unknown"
    try:
        n = int(num)
    except (ValueError, TypeError):
        return str(num)
    if n < 50:
        return "1-50"
    if n < 500:
        return "50-500"
    if n < 2000:
        return "500-2000"
    return "2000+"


def search_apollo_prospects(config: ApolloConfig, persona: str, industry: str = "travel") -> list:
    """
    Search Apollo.io for real B2B prospect profiles.
    Returns list of prospect dicts compatible with Agent 3's schema.
    """
    url = "https://api.apollo.io/v1/mixed_people/search"
    headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": config.api_key,
    }
    payload = {
        "person_titles": [persona],
        "q_keywords": f"{industry} technology hotel",
        "per_page": config.per_page,
        "page": 1,
    }
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        people = data.get("people", [])
        prospects = []
        for p in people:
            org = p.get("organization") or {}
            domain = org.get("primary_domain", "")
            fn = (p.get("first_name") or "").lower().strip()
            ln = (p.get("last_name") or "").lower().strip()
            email = p.get("email") or (f"{fn}.{ln}@{domain}" if domain and fn else "")
            prospect = {
                "id": str(_uuid.uuid4()),
                "first_name": p.get("first_name", ""),
                "last_name": p.get("last_name", ""),
                "email": email,
                "title": p.get("title", persona),
                "company": org.get("name", ""),
                "company_type": "other",
                "website": org.get("website_url", ""),
                "linkedin_url": p.get("linkedin_url", ""),
                "region": p.get("city") or p.get("country") or "Global",
                "employees": _apollo_employees_range(org.get("num_employees")),
                "status": "raw",
                "source": "apollo",
            }
            prospects.append(prospect)
        return prospects
    except requests.exceptions.ConnectionError:
        raise IntegrationError("Cannot connect to Apollo.io. Check your network.")
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else "?"
        if status == 401:
            raise IntegrationError("Apollo authentication failed (401). Check your API key.")
        elif status == 422:
            raise IntegrationError("Apollo rejected the search query (422). Check persona/industry values.")
        raise IntegrationError(f"Apollo API error ({status}): {str(e)}")
    except Exception as e:
        raise IntegrationError(f"Apollo search failed: {str(e)[:200]}")


def _extract_domain(url: str) -> str:
    """Strip protocol, www and path from URL → bare domain.
    e.g. 'https://www.booking.com/hotels' → 'booking.com'
    """
    if not url:
        return ""
    domain = url.strip()
    for prefix in ("https://", "http://"):
        if domain.startswith(prefix):
            domain = domain[len(prefix):]
            break
    if domain.startswith("www."):
        domain = domain[4:]
    domain = domain.split("/")[0].split("?")[0].split("#")[0]
    return domain.lower().strip()


def search_apollo_by_domains(
    config: ApolloConfig,
    domains: list,
    person_titles: list,
) -> list:
    """
    Domain-targeted Apollo search. Posts q_organization_domains_list to restrict
    results to specific companies. Returns prospect dicts with source='apollo_domain'.
    Raises IntegrationError on failure.
    """
    if not domains:
        raise IntegrationError("search_apollo_by_domains requires at least one domain.")
    url = "https://api.apollo.io/v1/mixed_people/search"
    headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": config.api_key,
    }
    payload = {
        "q_organization_domains_list": domains,
        "person_titles": person_titles,
        "per_page": config.per_page,
        "page": 1,
    }
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        people = data.get("people", [])
        prospects = []
        for p in people:
            org = p.get("organization") or {}
            domain = org.get("primary_domain", "")
            fn = (p.get("first_name") or "").lower().strip()
            ln = (p.get("last_name") or "").lower().strip()
            email = p.get("email") or (f"{fn}.{ln}@{domain}" if domain and fn else "")
            prospects.append({
                "id": str(_uuid.uuid4()),
                "first_name": p.get("first_name", ""),
                "last_name": p.get("last_name", ""),
                "email": email,
                "title": p.get("title", ""),
                "company": org.get("name", ""),
                "company_type": "other",
                "website": org.get("website_url", ""),
                "linkedin_url": p.get("linkedin_url", ""),
                "region": p.get("city") or p.get("country") or "Global",
                "employees": _apollo_employees_range(org.get("num_employees")),
                "status": "raw",
                "source": "apollo_domain",
            })
        return prospects
    except requests.exceptions.HTTPError as e:
        sc = e.response.status_code if e.response is not None else "?"
        if sc == 401:
            raise IntegrationError("Apollo authentication failed (401). Check your API key.")
        if sc == 422:
            raise IntegrationError("Apollo rejected the domain list (422). Ensure domains are bare hostnames.")
        raise IntegrationError(f"Apollo domain search error ({sc}): {str(e)}")
    except Exception as e:
        raise IntegrationError(f"Apollo domain search failed: {str(e)[:200]}")


def test_apollo_connection(config: ApolloConfig) -> dict:
    """
    Test Apollo connection with a minimal people search.
    """
    url = "https://api.apollo.io/v1/mixed_people/search"
    headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": config.api_key,
    }
    try:
        resp = requests.post(url, json={"per_page": 1, "page": 1}, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        credits = data.get("partial_results_limit", "unknown")
        return {
            "success": True,
            "message": f"Connected to Apollo.io successfully. Credits available: {credits}",
        }
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else "?"
        if status == 401:
            return {"success": False, "message": "Invalid Apollo API key (401)."}
        return {"success": False, "message": f"Apollo returned HTTP {status}"}
    except Exception as e:
        return {"success": False, "message": str(e)[:200]}


# ─────────────────────────────────────────────────────────────
# PhantomBuster
# ─────────────────────────────────────────────────────────────

import json as _json_module


@dataclass
class PhantomBusterConfig:
    api_key: str                      # PhantomBuster API key (Settings → API)
    search_phantom_id: str            # "LinkedIn Search Export" phantom Agent ID
    connection_phantom_id: str        # "LinkedIn Connection Sender" phantom Agent ID
    session_cookie: str               # LinkedIn li_at cookie (demo/local only)
    connections_per_launch: int = 10  # Cap per run to stay within LinkedIn daily limits


def _pb_headers(config: PhantomBusterConfig) -> dict:
    return {"X-Phantombuster-Key": config.api_key, "Content-Type": "application/json"}


def _pb_launch(config: PhantomBusterConfig, phantom_id: str, argument: dict) -> str:
    """Launch a phantom. Returns the containerId string."""
    resp = requests.post(
        "https://api.phantombuster.com/api/v2/agents/launch",
        json={"id": phantom_id, "argument": _json_module.dumps(argument)},
        headers=_pb_headers(config),
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["containerId"]


def _pb_poll(config: PhantomBusterConfig, container_id: str, timeout: int = 300) -> dict:
    """Poll a container until finished or timeout. Returns the result object dict."""
    import time as _time
    start = _time.time()
    while _time.time() - start < timeout:
        _time.sleep(10)
        r = requests.get(
            f"https://api.phantombuster.com/api/v2/containers/fetch-result-object?id={container_id}",
            headers=_pb_headers(config),
            timeout=20,
        )
        r.raise_for_status()
        data = r.json()
        if data.get("status") in ("finished", "error", "stopped"):
            return data
    raise IntegrationError("PhantomBuster search timed out after 5 minutes.")


def _parse_pb_csv(csv_text: str) -> list:
    """Parse PhantomBuster LinkedIn Search Export CSV into prospect dicts."""
    import csv
    import io
    prospects = []
    reader = csv.DictReader(io.StringIO(csv_text))
    for row in reader:
        ln_url = row.get("profileUrl") or row.get("linkedinProfileUrl") or ""
        if not ln_url:
            continue
        full_name = row.get("fullName") or f"{row.get('firstName', '')} {row.get('lastName', '')}".strip()
        first = row.get("firstName") or (full_name.split()[0] if full_name else "")
        last = row.get("lastName") or (" ".join(full_name.split()[1:]) if " " in full_name else "")
        company = row.get("company") or row.get("companyName") or ""
        domain = _extract_domain(row.get("companyUrl") or row.get("companyWebsite") or "")
        prospects.append({
            "id": str(_uuid.uuid4()),
            "first_name": first,
            "last_name": last,
            "email": f"{first.lower()}.{last.lower()}@{domain}" if domain and first else "",
            "title": row.get("title") or row.get("jobTitle") or "",
            "company": company,
            "company_type": "other",
            "website": f"https://{domain}" if domain else "",
            "linkedin_url": ln_url,
            "region": row.get("location") or "Global",
            "employees": "",
            "status": "raw",
            "source": "phantombuster_search",
        })
    return prospects


def _parse_pb_inline(output_text: str) -> list:
    """Fallback: try to parse JSON array embedded in phantom log output."""
    try:
        start = output_text.find("[")
        if start == -1:
            return []
        data = _json_module.loads(output_text[start:output_text.rfind("]") + 1])
        return _parse_pb_json_list(data)
    except Exception:
        return []


def _parse_pb_json_list(items: list) -> list:
    prospects = []
    for p in (items or []):
        if not isinstance(p, dict):
            continue
        ln_url = p.get("profileUrl") or p.get("linkedinProfileUrl") or ""
        domain = _extract_domain(p.get("companyUrl") or "")
        first = p.get("firstName") or ""
        last = p.get("lastName") or ""
        prospects.append({
            "id": str(_uuid.uuid4()),
            "first_name": first,
            "last_name": last,
            "email": f"{first.lower()}.{last.lower()}@{domain}" if domain and first else "",
            "title": p.get("title") or p.get("jobTitle") or "",
            "company": p.get("company") or p.get("companyName") or "",
            "company_type": "other",
            "website": f"https://{domain}" if domain else "",
            "linkedin_url": ln_url,
            "region": p.get("location") or "Global",
            "employees": "",
            "status": "raw",
            "source": "phantombuster_search",
        })
    return prospects


def search_phantombuster_prospects(config: PhantomBusterConfig, company_names: list) -> list:
    """
    Use LinkedIn Search Export phantom to find decision-makers at specific companies.
    Builds LinkedIn people-search URLs from company names + decision-maker title keywords,
    launches the phantom, polls for results, parses the output CSV/JSON.

    Returns list of prospect dicts with linkedin_url populated.
    Raises IntegrationError on failure.
    """
    from urllib.parse import quote

    SENIOR_KEYWORDS = (
        'CTO OR "VP Technology" OR "VP Engineering" OR "Head of Technology" '
        'OR "Chief Technology" OR Founder OR CEO'
    )
    search_urls = [
        f"https://www.linkedin.com/search/results/people/?keywords={quote(SENIOR_KEYWORDS + ' ' + name)}"
        for name in company_names[:8]  # cap at 8 to stay within free-tier limits
    ]

    argument = {
        "sessionCookie": config.session_cookie,
        "searches": search_urls,
        "numberOfResultsPerSearch": 5,
        "csvName": "agent3_prospects",
    }

    try:
        container_id = _pb_launch(config, config.search_phantom_id, argument)
        result = _pb_poll(config, container_id, timeout=300)

        if result.get("status") == "error":
            raise IntegrationError(
                f"PhantomBuster search phantom failed: {result.get('output', '')[:200]}"
            )

        # resultObject is a JSON string containing csvUrl
        result_obj = _json_module.loads(result.get("resultObject") or "{}")
        csv_url = result_obj.get("csvUrl") or result_obj.get("url")

        if not csv_url:
            # Sometimes output is embedded directly as JSON array in log
            return _parse_pb_inline(result.get("output", ""))

        csv_resp = requests.get(csv_url, timeout=30)
        csv_resp.raise_for_status()
        return _parse_pb_csv(csv_resp.text)

    except IntegrationError:
        raise
    except requests.exceptions.HTTPError as e:
        sc = e.response.status_code if e.response is not None else "?"
        if sc == 401:
            raise IntegrationError("PhantomBuster: invalid API key (401).")
        if sc == 404:
            raise IntegrationError(
                f"PhantomBuster: search phantom ID not found (404). Check search_phantom_id."
            )
        raise IntegrationError(f"PhantomBuster search error ({sc}): {str(e)}")
    except Exception as e:
        raise IntegrationError(f"PhantomBuster search failed: {str(e)[:200]}")


def launch_linkedin_connections(config: PhantomBusterConfig, prospects: list) -> dict:
    """
    Fire-and-forget: launch LinkedIn Connection Sender phantom with personalized messages.
    Each prospect needs a 'linkedin_url'. Uses prospect's 'connection_message' as the note.
    Returns the launch response dict with containerId.
    Raises IntegrationError on failure.
    """
    profiles = [
        {"url": p["linkedin_url"], "message": (p.get("connection_message") or "")[:200]}
        for p in prospects
        if p.get("linkedin_url")
    ]
    if not profiles:
        raise IntegrationError("launch_linkedin_connections: no prospects have a linkedin_url.")

    argument = {
        "sessionCookie": config.session_cookie,
        "profilesInput": profiles,
        "numberOfAddsPerLaunch": config.connections_per_launch,
    }
    try:
        container_id = _pb_launch(config, config.connection_phantom_id, argument)
        return {"containerId": container_id, "launched": len(profiles)}
    except requests.exceptions.HTTPError as e:
        sc = e.response.status_code if e.response is not None else "?"
        if sc == 401:
            raise IntegrationError("PhantomBuster: invalid API key (401).")
        if sc == 404:
            raise IntegrationError(
                f"PhantomBuster: connection phantom ID not found (404). Check connection_phantom_id."
            )
        raise IntegrationError(f"PhantomBuster connection launch error ({sc}): {str(e)}")
    except IntegrationError:
        raise
    except Exception as e:
        raise IntegrationError(f"PhantomBuster connection launch failed: {str(e)[:200]}")


def test_phantombuster_connection(config: PhantomBusterConfig) -> dict:
    """Verify PhantomBuster API key via /api/v2/user/me."""
    try:
        resp = requests.get(
            "https://api.phantombuster.com/api/v2/user/me",
            headers={"X-Phantombuster-Key": config.api_key},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        return {"success": True, "message": f"Connected. Account: {data.get('email', 'unknown')}"}
    except requests.exceptions.HTTPError as e:
        sc = e.response.status_code if e.response is not None else "?"
        return {"success": False, "message": f"PhantomBuster auth failed ({sc}): check your API key."}
    except Exception as e:
        return {"success": False, "message": f"PhantomBuster connection test failed: {str(e)[:200]}"}


# ─────────────────────────────────────────────────────────────
# HubSpot CRM
# ─────────────────────────────────────────────────────────────

@dataclass
class HubSpotConfig:
    access_token: str       # Private App token (starts with pat-)
    max_contacts: int = 100  # Max contacts to fetch per run


_HUBSPOT_FREE_EMAIL_DOMAINS = {
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "aol.com", "icloud.com", "protonmail.com", "ymail.com",
    "live.com", "msn.com", "yahoo.co.in", "rediffmail.com",
    "mail.com", "inbox.com", "zohomail.com",
}


def fetch_hubspot_contacts(config: HubSpotConfig) -> list:
    """
    Fetch contacts from HubSpot CRM via the CRM v3 API.
    Maps HubSpot contact properties to the Agent 2 lead schema.
    Handles pagination automatically up to max_contacts.
    Returns list of lead dicts compatible with Agent 2's schema.
    """
    headers = {
        "Authorization": f"Bearer {config.access_token}",
        "Content-Type": "application/json",
    }
    properties = "email,firstname,lastname,company,website,phone,hs_email_domain"
    leads = []
    after = None

    while len(leads) < config.max_contacts:
        limit = min(100, config.max_contacts - len(leads))
        url = (
            f"https://api.hubapi.com/crm/v3/objects/contacts"
            f"?limit={limit}&properties={properties}"
        )
        if after:
            url += f"&after={after}"

        try:
            resp = requests.get(url, headers=headers, timeout=30)
            resp.raise_for_status()
            data = resp.json()
        except requests.exceptions.ConnectionError:
            raise IntegrationError("Cannot connect to HubSpot. Check your network.")
        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response is not None else "?"
            if status == 401:
                raise IntegrationError(
                    "HubSpot authentication failed (401). Check your Private App access token."
                )
            elif status == 403:
                raise IntegrationError(
                    "HubSpot access denied (403). Ensure your Private App has CRM contacts read scope."
                )
            raise IntegrationError(f"HubSpot API error ({status}): {str(e)}")
        except Exception as e:
            raise IntegrationError(f"HubSpot fetch failed: {str(e)[:200]}")

        results = data.get("results", [])
        for contact in results:
            props = contact.get("properties") or {}
            email = (props.get("email") or "").strip().lower()
            if not email:
                continue
            fn = props.get("firstname") or ""
            ln = props.get("lastname") or ""
            name = f"{fn} {ln}".strip() or None
            website = props.get("website") or ""
            if not website:
                email_domain = props.get("hs_email_domain") or ""
                if email_domain:
                    website = "https://" + email_domain
                elif "@" in email:
                    raw_domain = email.split("@")[-1].lower()
                    if raw_domain not in _HUBSPOT_FREE_EMAIL_DOMAINS:
                        website = "https://" + raw_domain
            if website and not website.startswith("http"):
                website = "https://" + website
            lead = {
                "id": f"hs-{contact.get('id', _uuid.uuid4())}",
                "email": email,
                "name": name,
                "company": props.get("company") or None,
                "website": website or None,
                "source": "hubspot",
                "hubspot_id": contact.get("id", ""),
                "created_at": contact.get("createdAt", ""),
            }
            leads.append(lead)

        paging = data.get("paging") or {}
        next_page = paging.get("next") or {}
        after = next_page.get("after")
        if not after or not results:
            break

    return leads


def test_hubspot_connection(config: HubSpotConfig) -> dict:
    """
    Test HubSpot connection by fetching a single contact.
    Returns dict with success status and contact count info.
    """
    headers = {
        "Authorization": f"Bearer {config.access_token}",
        "Content-Type": "application/json",
    }
    try:
        resp = requests.get(
            "https://api.hubapi.com/crm/v3/objects/contacts?limit=1&properties=email",
            headers=headers,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        total = data.get("total", "unknown")
        return {
            "success": True,
            "message": f"Connected to HubSpot successfully. Total contacts in CRM: {total}",
        }
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else "?"
        if status == 401:
            return {"success": False, "message": "Invalid HubSpot access token (401). Check your Private App token."}
        elif status == 403:
            return {"success": False, "message": "Access denied (403). Ensure Private App has 'crm.objects.contacts.read' scope."}
        return {"success": False, "message": f"HubSpot returned HTTP {status}"}
    except Exception as e:
        return {"success": False, "message": str(e)[:200]}
