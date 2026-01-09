# TaskScore

A tool for scorers of hang gliding / paragliding competitions analyse track log files (IGC) against the task set for a day. It will also be useful for pilots who want to understand their flight performance especially with respect to scores and task completion. Hence the name - TaskScore.

Tasks can be loaded from XContest, or other sources such as a QR code.

I want to be able to draw turn point circles on the map as well as other reference information such as paddocks that we're not meant to land in.

Analyses a flight and explains the flight path based on the task set.

Example of flight analysis:
- 12:30pm launched in tp ELLIOT
- 1:05pm exited start tp ELLIOT at 7000ft
- 1:10pm re-entered start tp ELLIOT
- 1:15pm exited start tp ELLIOT
- 1:20pm low save 
- 1:30pm tagged tp TOWONG
- 1:40pm landed in bombout paddock, 7km from NCORGL (30 bombout points)

In the last example, it's useful to know the distance to the next waypoint in the task set.

# Tools
- TBD

# Project structure

- /explorations -- Exploratory code to explore ideas and tools. This code must not be used in production.

# Deployment
- TBD

# Documentation
- All features to be documented as specifications at `specs/{feature}-spec.md`

# Coding Preferences
- MUST always read the documentation for libraries using the Context7 tool
- MUST NOT
- Place exploration code in the `explorations` directory. This code must not be used in production.
