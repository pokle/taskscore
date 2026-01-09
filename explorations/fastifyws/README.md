# Fastify server

Start with: `npm run dev`

ab -n 100000 -c 10 http://localhost:3000/ping
```
Server Software:
Server Hostname:        localhost
Server Port:            3000

Document Path:          /ping
Document Length:        21 bytes

Concurrency Level:      10
Time taken for tests:   3.019 seconds
Complete requests:      100000
Failed requests:        0
Total transferred:      16300000 bytes
HTML transferred:       2100000 bytes
Requests per second:    33121.13 [#/sec] (mean)
Time per request:       0.302 [ms] (mean)
Time per request:       0.030 [ms] (mean, across all concurrent requests)
Transfer rate:          5272.21 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.7      0     158
Processing:     0    0   1.3      0     158
Waiting:        0    0   1.3      0     158
Total:          0    0   1.5      0     159

Percentage of the requests served within a certain time (ms)
  50%      0
  66%      0
  75%      0
  80%      0
  90%      0
  95%      0
  98%      0
  99%      0
 100%    159 (longest request)
```
