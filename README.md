## EVO

**EVO** is my attempt at a base framework soul that I can use for every single future project, from game NPCs, to furry AI influencers, to discord bots etc

The core ethos of Evo is to evolve overtime. The most important thing I've devved here is a simple framework to remember individual notes about users and have an easy way of updating them subconciously

Memory and consistency is important when it comes to users "growing relationships" with AI souls.

I've done this before but not in a Soul Engine way which is essential.

## HOW EVO WORKS
(so far)
- Keeps track of interaction count per user
- Every 10 interactions the subprocess rememberUser.ts fires
- rememberUser.ts allows Evo to reflect and take notes on a user, creating temporary notes as well as long term memory notes
- retrieves unique info per user when talked to, and loads in relevant long term memories
- Summarizes chat log conversations and adds it to long term memory
- Has surface level memory retrieval on a unique user basis + general basis, loading in any relevant long term memories depending on user query
- Has a task list, can pre plan tasks which help with conversation structure, follow them through, and process if they completed the tasks or not.

https://github.com/kingbootoshi/evo/assets/127834715/4c05f109-68f0-4e8e-a7ec-6ec11ae8bc69
