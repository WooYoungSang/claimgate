package main

import (
	"encoding/json"
	"fmt"
)

var planningFieldNames = []string{"aec", "acceptance_criteria", "implementation_plan"}

type agentExecutionContract struct {
	Schema          string `json:"schema"`
	AgentAssignment struct {
		Role string `json:"role"`
	} `json:"agent_assignment"`
	WorkOrder         string `json:"work_order"`
	OwnershipBoundary struct {
		Repo               string   `json:"repo"`
		ExclusiveFileLease []string `json:"exclusive_file_lease"`
	} `json:"ownership_boundary"`
	ExpectedTouchedFiles   []string `json:"expected_touched_files"`
	DoneCriteria           []string `json:"done_criteria"`
	AcceptanceCriteriaRefs []string `json:"acceptance_criteria_refs"`
	CoordinationRule       string   `json:"coordination_rule"`
	UoWMapping             []string `json:"uow_mapping"`
	NoGoKillCondition      []string `json:"no_go_kill_condition"`
}

type acceptanceCriteriaContract struct {
	Schema   string `json:"schema"`
	Criteria []struct {
		ID           string `json:"id"`
		Behavior     string `json:"behavior"`
		ProofCommand string `json:"proof_command"`
		Expected     string `json:"expected"`
	} `json:"criteria"`
	NegativeControls []struct {
		ID              string `json:"id"`
		Mutation        string `json:"mutation"`
		ProofCommand    string `json:"proof_command"`
		ExpectedFailure string `json:"expected_failure"`
	} `json:"negative_controls"`
}

type implementationPlanContract struct {
	Schema   string   `json:"schema"`
	Patterns []string `json:"patterns"`
	Steps    []struct {
		Order   int      `json:"order"`
		Action  string   `json:"action"`
		Outputs []string `json:"outputs"`
		Verify  []string `json:"verify"`
	} `json:"steps"`
	Handoff string `json:"handoff"`
}

func validateWorkpacketPlanningFields(value map[string]any) error {
	present := 0
	for _, field := range planningFieldNames {
		if _, ok := value[field]; ok {
			present++
		}
	}
	if present == 0 {
		return nil
	}
	if present != len(planningFieldNames) {
		return fmt.Errorf("workpacket planning fields must be registered together: aec, acceptance_criteria, implementation_plan")
	}
	texts := make(map[string]string, len(planningFieldNames))
	for _, field := range planningFieldNames {
		text, ok := value[field].(string)
		if !ok || text == "" {
			return fmt.Errorf("workpacket planning field %q must be a non-empty JSON string", field)
		}
		texts[field] = text
	}
	if err := validateAEC(texts["aec"]); err != nil {
		return fmt.Errorf("invalid workpacket aec: %w", err)
	}
	if err := validateAcceptanceCriteria(texts["acceptance_criteria"]); err != nil {
		return fmt.Errorf("invalid workpacket acceptance_criteria: %w", err)
	}
	if err := validateImplementationPlan(texts["implementation_plan"]); err != nil {
		return fmt.Errorf("invalid workpacket implementation_plan: %w", err)
	}
	return nil
}

func validateAEC(text string) error {
	var contract agentExecutionContract
	if err := json.Unmarshal([]byte(text), &contract); err != nil {
		return fmt.Errorf("decode claimgate.aec/v1: %w", err)
	}
	if contract.Schema != "claimgate.aec/v1" {
		return fmt.Errorf("schema=%q, want claimgate.aec/v1", contract.Schema)
	}
	if contract.AgentAssignment.Role == "" || contract.WorkOrder == "" || contract.OwnershipBoundary.Repo == "" || contract.CoordinationRule == "" {
		return fmt.Errorf("agent_assignment.role, work_order, ownership_boundary.repo and coordination_rule are required")
	}
	for name, values := range map[string][]string{
		"ownership_boundary.exclusive_file_lease": contract.OwnershipBoundary.ExclusiveFileLease,
		"expected_touched_files":                  contract.ExpectedTouchedFiles,
		"done_criteria":                           contract.DoneCriteria,
		"acceptance_criteria_refs":                contract.AcceptanceCriteriaRefs,
		"uow_mapping":                             contract.UoWMapping,
		"no_go_kill_condition":                    contract.NoGoKillCondition,
	} {
		if err := requireNonEmptyStrings(name, values); err != nil {
			return err
		}
	}
	return nil
}

func validateAcceptanceCriteria(text string) error {
	var contract acceptanceCriteriaContract
	if err := json.Unmarshal([]byte(text), &contract); err != nil {
		return fmt.Errorf("decode claimgate.ac/v1: %w", err)
	}
	if contract.Schema != "claimgate.ac/v1" {
		return fmt.Errorf("schema=%q, want claimgate.ac/v1", contract.Schema)
	}
	if len(contract.Criteria) == 0 {
		return fmt.Errorf("criteria must contain at least one executable criterion")
	}
	for index, criterion := range contract.Criteria {
		if criterion.ID == "" || criterion.Behavior == "" || criterion.ProofCommand == "" || criterion.Expected == "" {
			return fmt.Errorf("criteria[%d] requires id, behavior, proof_command and expected", index)
		}
	}
	if len(contract.NegativeControls) == 0 {
		return fmt.Errorf("negative_controls must contain at least one partial-weakening probe")
	}
	for index, control := range contract.NegativeControls {
		if control.ID == "" || control.Mutation == "" || control.ProofCommand == "" || control.ExpectedFailure == "" {
			return fmt.Errorf("negative_controls[%d] requires id, mutation, proof_command and expected_failure", index)
		}
	}
	return nil
}

func validateImplementationPlan(text string) error {
	var contract implementationPlanContract
	if err := json.Unmarshal([]byte(text), &contract); err != nil {
		return fmt.Errorf("decode claimgate.implementation-plan/v1: %w", err)
	}
	if contract.Schema != "claimgate.implementation-plan/v1" {
		return fmt.Errorf("schema=%q, want claimgate.implementation-plan/v1", contract.Schema)
	}
	if err := requireNonEmptyStrings("patterns", contract.Patterns); err != nil {
		return err
	}
	if len(contract.Steps) == 0 || contract.Handoff == "" {
		return fmt.Errorf("steps and handoff are required")
	}
	for index, step := range contract.Steps {
		if step.Order != index+1 || step.Action == "" {
			return fmt.Errorf("steps[%d] requires contiguous order=%d and non-empty action", index, index+1)
		}
		if err := requireNonEmptyStrings(fmt.Sprintf("steps[%d].outputs", index), step.Outputs); err != nil {
			return err
		}
		if err := requireNonEmptyStrings(fmt.Sprintf("steps[%d].verify", index), step.Verify); err != nil {
			return err
		}
	}
	return nil
}

func requireNonEmptyStrings(name string, values []string) error {
	if len(values) == 0 {
		return fmt.Errorf("%s must contain at least one entry", name)
	}
	for index, value := range values {
		if value == "" {
			return fmt.Errorf("%s[%d] must be non-empty", name, index)
		}
	}
	return nil
}

func verifyWorkpacketPlanningContracts(data []byte) error {
	definition, _ := definitionFor("workpacket")
	records, err := recordsFor(data, definition)
	if err != nil {
		return err
	}
	for _, record := range records {
		if err := validateWorkpacketPlanningFields(record.value); err != nil {
			id, _ := record.value["id"].(string)
			return fmt.Errorf("workpacket %q planning contract: %w", id, err)
		}
	}
	return nil
}
