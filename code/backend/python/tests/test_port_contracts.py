"""Contract tests for every core port: each one declares abstract methods and its
default body is a no-op, so an adapter that calls ``super()`` gets ``None``."""
import importlib
import inspect
from abc import ABC
from pathlib import Path

import pytest

import app.core.ports as ports_package

_PORTS_ROOT = Path(list(ports_package.__path__)[0])


def _port_modules():
    """Every module file under ``app/core/ports`` — some folders have no ``__init__``."""
    for path in sorted(_PORTS_ROOT.rglob("*.py")):
        if "__pycache__" in path.parts or path.name == "__init__.py":
            continue
        relative = path.relative_to(_PORTS_ROOT).with_suffix("")
        yield f"{ports_package.__name__}." + ".".join(relative.parts)


def _discover_ports():
    """Collects every abstract port class declared under ``app.core.ports``."""
    found = {}
    for module_name in _port_modules():
        module = importlib.import_module(module_name)
        for _, obj in inspect.getmembers(module, inspect.isclass):
            if obj.__module__ == module_name and ABC in obj.__bases__ and obj.__abstractmethods__:
                found[f"{obj.__module__}.{obj.__name__}"] = obj
    return [found[key] for key in sorted(found)]


PORTS = _discover_ports()


def _concrete(port):
    """Builds a subclass whose implementations delegate to the abstract bodies."""
    namespace = {}
    for name in sorted(port.__abstractmethods__):
        base = getattr(port, name)

        def make(base_impl):
            def impl(self, *args, **kwargs):
                return base_impl(self, *args, **kwargs)
            return impl

        namespace[name] = make(base)
    return type(f"Concrete{port.__name__}", (port,), namespace)


@pytest.mark.parametrize("port", PORTS, ids=lambda p: p.__name__)
def test_port_cannot_be_instantiated_directly(port):
    assert port.__abstractmethods__, f"{port.__name__} declares no abstract method"
    with pytest.raises(TypeError):
        port()


@pytest.mark.parametrize("port", PORTS, ids=lambda p: p.__name__)
def test_abstract_bodies_are_no_ops(port):
    instance = _concrete(port)()
    for name in sorted(port.__abstractmethods__):
        signature = inspect.signature(getattr(port, name))
        args = [None] * (len(signature.parameters) - 1)
        assert getattr(instance, name)(*args) is None


def test_story_query_port_trait_default_is_not_implemented():
    """Kept non-abstract for the existing fakes, but no fake may rely on the default."""
    from app.core.ports.story.story_query_port import StoryQueryPort

    concrete = _concrete(StoryQueryPort)()
    with pytest.raises(NotImplementedError):
        concrete.list_traits_for_class("s1", "c1")
