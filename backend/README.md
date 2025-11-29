# TODO
- [X] Document Switch.ts
- [X] Document Node.ts
- [X] Switch MAC table cleanup: expiration is checked in lookupMAC() but never proactively clean old entries. Consider adding a cleanup method called periodically
- [X] Firewall logging improvement: When a packet is dropped, log which rule caused it
- [ ] Implement and Document IP.ts - NetworkInterface static methods
- [ ] Delay, bandwidth in Link.ts

---
- [ ] Make toJSON abstract method and make it individually in Firewall, Host, Router and Switch
- [ ] Create Simulation Start/Stop/Step/Reset routes
- [ ] Create Packet Management routes (under simulation)
---
- [ ] Create dockerfile
- [ ] Create docker-compose.yml

sudo docker run --name packetflow-postgres   -e POSTGRES_USER=admin   -e POSTGRES_PASSWORD=admin123   -e POSTGRES_DB=packetflow   -p 5432:5432   -d postgres:16-alpine

sudo docker run packetflow-postgres