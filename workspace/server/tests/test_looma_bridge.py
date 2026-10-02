from app.services.looma_bridge import current_question

def test_only_current_question_crosses_bridge():
    assert current_question([
        {'role':'system','content':'private task: payroll'},
        {'role':'user','content':'old personal details'},
        {'role':'assistant','content':'private MCP results'},
        {'role':'user','content':'Hello Looma'},
    ]) == 'Hello Looma'

def test_missing_question_does_not_forward_context():
    assert current_question([{'role':'system','content':'private memory'}]) == ''
