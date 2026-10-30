# ParallelWriteHelper.py — v1.7.0 V1 step 8: the same gameplay write sent at once by two threads (two devices
# of one player), released together by a barrier; answers the status and JSON body of each.
import threading

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def parallel_posts(url, headers_list, body=None, timeout=30):
    """POSTs `url` once per headers dict, all threads released together; [{status, body}] in order."""
    headers_list = list(headers_list)
    barrier = threading.Barrier(len(headers_list))
    results = [None] * len(headers_list)

    def send(index, headers):
        barrier.wait()
        try:
            response = requests.post(url, headers=dict(headers), json=body, timeout=float(timeout), verify=False)
        except requests.RequestException as exc:
            results[index] = {"status": 0, "body": {"error": str(exc)}}
            return
        try:
            payload = response.json()
        except ValueError:
            payload = {}
        results[index] = {"status": response.status_code, "body": payload}

    threads = [threading.Thread(target=send, args=(i, h)) for i, h in enumerate(headers_list)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    return results
