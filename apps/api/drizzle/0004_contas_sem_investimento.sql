-- Finanças v0 sem investimentos: o tipo de conta "investimento" deixou de existir.
UPDATE `contas` SET `tipo` = 'poupanca' WHERE `tipo` = 'investimento';
