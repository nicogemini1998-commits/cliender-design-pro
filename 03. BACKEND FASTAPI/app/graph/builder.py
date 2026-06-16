"""Construye el grafo LangGraph del enjambre."""
from __future__ import annotations

from langgraph.graph import START, StateGraph

from app.graph.nodes.cinematographer import cinematographer_node
from app.graph.nodes.critic import critic_node
from app.graph.nodes.master_director import master_director_node
from app.graph.nodes.production import production_node
from app.graph.nodes.scriptwriter import scriptwriter_node
from app.graph.routing import bump_retries, critic_router
from app.graph.state import SwarmState


def build_graph():
    """Construye y compila el grafo cíclico del enjambre.

      START → master_director → scriptwriter → cinematographer → production → critic
                                                  ↑                              │
                                                  └────── bump_retries ──────────┘ (si rechaza)
                                                                                 │
                                                                                 └──→ END (si aprueba)
    """
    g: StateGraph = StateGraph(SwarmState)

    g.add_node("master_director", master_director_node)
    g.add_node("scriptwriter", scriptwriter_node)
    g.add_node("cinematographer", cinematographer_node)
    g.add_node("production", production_node)
    g.add_node("critic", critic_node)
    g.add_node("bump_retries", bump_retries)

    g.add_edge(START, "master_director")
    g.add_edge("master_director", "scriptwriter")
    g.add_edge("scriptwriter", "cinematographer")
    g.add_edge("cinematographer", "production")
    g.add_edge("production", "critic")

    # Edge condicional desde Critic
    g.add_conditional_edges(
        "critic",
        critic_router,
        {
            "cinematographer": "bump_retries",
            "__end__": "__end__",
        },
    )
    g.add_edge("bump_retries", "cinematographer")

    return g.compile()
